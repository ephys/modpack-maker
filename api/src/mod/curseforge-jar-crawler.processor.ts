import * as assert from 'assert';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import fetch from 'node-fetch';
import { Sequelize, Op } from 'sequelize';
import * as minecraftVersion from '../../../common/minecraft-versions.json';
import { ModLoader } from '../../../common/modloaders';
import { getCurseForgeModFiles, getCurseReleaseType } from '../curseforge.api';
import type { TCurseFile } from '../curseforge.api';
import { InjectSequelize } from '../database/database.providers';
import { getModMetasFromJar } from '../mod-jar-data-extraction/mod-data-extractor';
import { INSERT_DISCOVERED_MODS_QUEUE } from '../modpack/modpack.constants';
import { generateId } from '../utils/generic-utils';
import type { TFetchJarQueueData } from './curseforge-project-list-crawler';
import { ModJar } from './mod-jar.entity';
import { ModVersion } from './mod-version.entity';
import { FETCH_CURSE_JARS_QUEUE } from './mod.constants';
import { Project, ProjectSource } from './project.entity';

@Processor(FETCH_CURSE_JARS_QUEUE)
export class CurseforgeJarCrawlerProcessor {
  private readonly logger = new Logger(CurseforgeJarCrawlerProcessor.name);

  constructor(
    @InjectQueue(INSERT_DISCOVERED_MODS_QUEUE) private readonly insertDiscoveredModsQueue: Queue,
    @InjectSequelize private readonly sequelize: Sequelize,
  ) {
  }

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
      const files = await getCurseForgeModFiles(sourceProjectId);
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

      assert(cfProject != null);

      for (const file of files) {
        const fileId = String(file.id);

        // file has already been processed
        if (existingFilesIds.has(fileId)) {
          continue;
        }

        // someone needs to clear this error before we try again
        if (cfProject.failedFiles[fileId] != null) {
          return;
        }

        this.logger.log(`Processing CURSEFORGE file ${fileId} (${file.displayName})`);

        try {
          // eslint-disable-next-line no-await-in-loop
          await this.processFile(file, cfProject);
        } catch (e) {
          this.logger.error(`Processing CURSEFORGE file ${fileId} (${file.displayName}) failed:`);
          this.logger.error(e.message);

          const error = e.message;
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

      await Promise.all([
        Project.update({
          versionListUpToDate: true,
        }, {
          where: {
            sourceType: projectSourceType,
            sourceId: sourceProjectId,
          },
        }),
        this.insertDiscoveredModsQueue.add(sourceProjectId),
      ]);
    } catch (e) {
      this.logger.error(`Error while processing ${job.data}`);
      this.logger.error(e);

      throw e;
    }
  }

  private async processFile(sourceFileMeta: TCurseFile, project: Project): Promise<void> {

    const supportedPlatforms = sourceFileMeta.gameVersion.map(version => version.toUpperCase());
    const supportedMcVersions = new Set<string>();
    for (const platform of supportedPlatforms) {
      if (minecraftVersion.includes(platform)) {
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
    const mods: ModVersion[] = await getModVersionsFromJar(sourceFileMeta.downloadUrl, supportedMcVersions);
    if (mods.length === 0) {
      throw new Error('No mod found in jar');
    }

    const modJar = ModJar.build({
      externalId: generateId(),
      projectId: project.internalId,
      fileName: sourceFileMeta.fileName,
      sourceFileId: String(sourceFileMeta.id),
      downloadUrl: sourceFileMeta.downloadUrl,
      releaseType: getCurseReleaseType(sourceFileMeta.releaseType),
      releaseDate: sourceFileMeta.fileDate,
    });

    await this.sequelize.transaction(async transaction => {
      await modJar.save({ transaction });
      await Promise.all(mods.map(async mod => {
        mod.jarId = modJar.internalId;

        return mod.save({ transaction });
      }));
    });
  }
}

export async function getModVersionsFromJar(jarUrl: string, supportedMcVersions: Set<string>) {
  const fileBuffer = await downloadModFile(jarUrl);
  const modMetas = await getModMetasFromJar(fileBuffer);

  const mods: ModVersion[] = [];

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

    const version = ModVersion.build({
      modId: meta.modId,
      displayName: meta.name,
      modVersion: meta.version,
      supportedMinecraftVersions: Array.from(supportedMcVersions),
      // FIXME: see above fixme regarding MC version in jar meta
      supportedMinecraftVersionRange: '', // meta.minecraftVersionRange,
      supportedModLoader: meta.loader,
      dependencies: meta.dependencies || [],
    });

    mods.push(version);
  }

  return mods;
}

// TODO: verify sha
export async function downloadModFile(url, retryAttempts = 3) {
  try {
    const result = await fetch(url);

    return await result.buffer();
  } catch (e) {
    if (retryAttempts > 0 && e.code === 'ETIMEDOUT') {
      return downloadModFile(url, retryAttempts - 1);
    }

    throw e;
  }
}
