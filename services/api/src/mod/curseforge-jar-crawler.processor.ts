import assert from 'node:assert';
import * as crypto from 'node:crypto';
import type { ExcludeNullProperties, ExcludePropertiesOfType } from '@ephys/fox-forge';
import { ModLoader, minecraftVersions } from '@ephys/modpack-maker-common';
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Op, Sequelize } from '@sequelize/core';
import type { Attributes } from '@sequelize/core';
import { Job } from 'bull';
import fetch from 'node-fetch';
import { getCurseReleaseType, iterateCurseForgeModFileList } from '../curseforge.api.js';
import type { TCurseFile } from '../curseforge.api.js';
import { InjectSequelize } from '../database/database.providers.js';
import { getModMetasFromJar } from '../mod-jar-data-extraction/mod-data-extractor.js';
import { Project, ProjectSource } from '../project/project.entity.js';
import { generateId } from '../utils/generic-utils.js';
import type { TFetchJarQueueData } from './curseforge-project-list-crawler.js';
import { ModJar } from './mod-jar.entity.js';
import { ModVersion } from './mod-version.entity.js';
import { FETCH_CURSE_JARS_QUEUE } from './mod.constants.js';

@Processor(FETCH_CURSE_JARS_QUEUE)
export class CurseforgeJarCrawlerProcessor {
  private readonly logger = new Logger(CurseforgeJarCrawlerProcessor.name);

  constructor(
    @InjectSequelize private readonly sequelize: Sequelize,
  ) {}

  @Process({
    concurrency: 10,
  })
  async fetchCurseProjectFiles(job: Job<TFetchJarQueueData>) {
    const projectSourceType = job.data[0];
    const sourceProjectId = job.data[1];

    if (projectSourceType == null) {
      this.logger.error(`Queue ${job.queue.name} received null projectSourceType`);

      return;
    }

    if (sourceProjectId == null) {
      this.logger.error(`Queue ${job.queue.name} received null sourceProjectId`);

      return;
    }

    if (projectSourceType !== ProjectSource.CURSEFORGE) {
      this.logger.error(`unsupported source "${projectSourceType}:${sourceProjectId}"`);

      return;
    }

    this.logger.log(`Processing ${projectSourceType} mod ${sourceProjectId}`);

    try {
      const files: TCurseFile[] = [];
      for await (const file of iterateCurseForgeModFileList(sourceProjectId, { pageSize: 50 })) {
        files.push(file);
      }

      const fileIds: string[] = files.map(file => String(file.id));

      const existingFiles = await ModJar.findAll({
        attributes: ['sourceFileId'],
        where: { sourceFileId: { [Op.in]: fileIds } },
      });

      const existingFilesIds = new Set(existingFiles.map(item => item.sourceFileId));

      const cfProject = await Project.findOne({
        where: {
          sourceType: projectSourceType,
          sourceId: sourceProjectId,
        },
      });

      assert(cfProject != null, 'local version of curseforge project does not exist');

      for (const file of files) {
        const fileId = String(file.id);

        // file has already been processed
        if (existingFilesIds.has(fileId)) {
          continue;
        }

        // someone needs to clear this error before we try again
        if (cfProject.failedFiles[fileId] != null) {
          continue;
        }

        this.logger.log(`Processing CURSEFORGE file ${fileId} (${file.displayName})`);

        try {
          if (file.downloadUrl == null) {
            throw new Error('MISSING_DOWNLOAD_URL');
          }

          // eslint-disable-next-line no-await-in-loop
          await this.processFile(file as ExcludePropertiesOfType<TCurseFile, null, 'downloadUrl'>, cfProject);
        } catch (error_) {
          this.logger.error(`Processing CURSEFORGE file ${fileId} (${file.displayName}) failed:`);
          this.logger.error(error_);

          const error = error_.message;
          if (cfProject.failedFiles[fileId] !== error) {
            cfProject.failedFiles = {
              ...cfProject.failedFiles,
              [fileId]: error,
            };

            // eslint-disable-next-line no-await-in-loop
            await cfProject.save();
          }
        }
      }

      cfProject.versionListUpToDate = true;
      await cfProject.save();

      this.logger.log(`Processed ${projectSourceType} mod ${sourceProjectId}`);
    } catch (error) {
      this.logger.error(`Error while processing ${job.data}`);
      this.logger.error(error);

      throw error;
    }
  }

  private async processFile(sourceFileMeta: ExcludeNullProperties<TCurseFile, 'downloadUrl'>, project: Project): Promise<void> {

    const supportedPlatforms = sourceFileMeta.gameVersions.map(version => version.toUpperCase());
    const supportedMcVersions = new Set<string>();
    for (const platform of supportedPlatforms) {
      if (minecraftVersions.includes(platform)) {
        supportedMcVersions.add(platform);
        continue;
      }

      // extracted from internal manifest
      if (Object.keys(ModLoader).includes(platform)) {
        continue;
      }

      if (platform.endsWith('-SNAPSHOT')) {
        continue;
      }

      throw new Error(`[CurseForge File ${sourceFileMeta.id}] Unknown Platform: ${platform}`);
    }

    // modJar.bundledMods
    const { modVersions, sha512, byteLength } = await extractJarInfo(sourceFileMeta.downloadUrl, supportedMcVersions);
    if (modVersions.length === 0) {
      throw new Error('No mod found in jar');
    }

    const modJar = ModJar.build({
      byteLength,
      downloadUrl: sourceFileMeta.downloadUrl,
      externalId: generateId(),
      fileName: sourceFileMeta.fileName,
      projectId: project.internalId,
      releaseDate: sourceFileMeta.fileDate,
      releaseType: getCurseReleaseType(sourceFileMeta.releaseType),
      sha512,
      sourceFileId: String(sourceFileMeta.id),
    });

    await this.sequelize.transaction(async transaction => {
      await modJar.save({ transaction });
      await Promise.all(modVersions.map(async mod => {
        return ModVersion.create({
          ...mod,
          jarId: modJar.internalId,
        }, {
          transaction,
        });
      }));
    });
  }
}

export type PartialModVersion = Omit<Attributes<ModVersion>, 'jarId'>;

export interface JarInfo {
  sha512: ArrayBuffer;
  byteLength: number;
  modVersions: PartialModVersion[];
}

export async function extractJarInfo(jarUrl: string, supportedMcVersions: Set<string>): Promise<JarInfo> {
  const fileBuffer = await downloadModFile(jarUrl);

  const [modMetas, sha512] = await Promise.all([
    getModMetasFromJar(fileBuffer),
    crypto.subtle.digest('sha-512', fileBuffer),
  ]);

  const mods: PartialModVersion[] = [];

  for (const meta of modMetas) {

    // FIXME: we tried extracting Minecraft Version from Mod Jar but a lot of mods are declaring their version as >=1.x
    //  meaning the following Major version is considered valid
    //  For mods coming from curse, we'll just use the curse list
    //  If we start uploading mods ourselves, we'll warn the user if their version range is fishy (ie. unbound)
    // if (meta.minecraftVersionRange) {
    //   // denormalize version range for easier DB querying
    //   for (const version of getMinecraftVersionsInRange(meta.minecraftVersionRange)) {
    //     supportedMcVersions.add(version);
    //   }
    // }

    // forbid uploading the default project mod name.
    if (meta.modId === 'examplemod') {
      throw new Error(`Mod is declaring a mod with modId examplemod`);
    }

    mods.push({
      modId: meta.modId,
      displayName: meta.name,
      modVersion: meta.version,
      supportedMinecraftVersions: [...supportedMcVersions],
      // FIXME: see above fixme regarding MC version in jar meta
      supportedMinecraftVersionRange: '', // meta.minecraftVersionRange,
      supportedModLoader: meta.loader,
      dependencies: meta.dependencies || [],
    });
  }

  return { modVersions: mods, byteLength: fileBuffer.byteLength, sha512 };
}

// TODO: verify sha
export async function downloadModFile(url: string, retryAttempts = 3): Promise<ArrayBuffer> {
  assert(typeof url === 'string', 'url must be a string');

  try {
    const result = await fetch(url);

    return await result.arrayBuffer();
  } catch (error) {
    if (retryAttempts > 0 && error.code === 'ETIMEDOUT') {
      return downloadModFile(url, retryAttempts - 1);
    }

    throw error;
  }
}
