import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { getCurseForgeModFiles, getCurseReleaseType, TForgeFile } from '../curseforge.api';
import { ModVersion } from './mod-version.entity';
import { Op, Sequelize } from 'sequelize';
import fetch from 'node-fetch';
import { getModMetasFromJar } from '../mod-jar-data-extraction/mod-data-extractor';
import * as minecraftVersion from '../../../common/minecraft-versions.json';
import { ModLoader } from '../../../common/modloaders';
import { INSERT_DISCOVERED_MODS_QUEUE } from '../modpack/modpack.constants';
import { ModJar } from './mod-jar.entity';
import { InjectSequelize } from '../database/database.providers';
import { generateId } from '../utils/generic-utils';

// TODO: every 15 minutes, if queue is empty, fill it with every mod that is in a modpack & whose versionListUpToDate is false

@Processor('fetch-curse-project-files')
export class CurseforgeFileCrawlerProcessor {
  private readonly logger = new Logger(CurseforgeFileCrawlerProcessor.name);

  constructor(
    @InjectQueue(INSERT_DISCOVERED_MODS_QUEUE) private insertDiscoveredModsQueue: Queue,
    @InjectSequelize private readonly sequelize: Sequelize,
  ) {
  }

  @Process()
  async fetchCurseProjectFiles(job: Job<number>) {
    const curseProjectId = job.data;
    console.log('Processing CurseForge mod ' + curseProjectId);

    const files = await getCurseForgeModFiles(curseProjectId);

    const fileIds = [];

    for (const file of files) {
      fileIds.push(file.id);
    }

    const existingFiles = await ModJar.findAll({
      attributes: ['curseFileId'],
      where: { curseFileId: { [Op.in]: fileIds } },
    });

    const existingFilesIds = new Set(existingFiles.map(item => item.curseFileId));

    for (const file of files) {
      // file has already been processed
      // TODO: cache mod file metadata so we can update the forge meta without having to parse the Jar again
      if (existingFilesIds.has(file.id)) {
        continue;
      }

      console.log('Processing file', file.id, `(${file.displayName})`);

      try {
        await this.processFile(file, curseProjectId);
      } catch (e) {
        console.error('Processing Curse file ' + file.id + ' failed:');
        console.error(e);

        return;
      }
    }

    await this.insertDiscoveredModsQueue.add(curseProjectId);
  }

  private async processFile(fileData: TForgeFile, curseProjectId: number) {
    const fileBuffer = await downloadModFile(fileData.downloadUrl);

    const modMetas = await getModMetasFromJar(fileBuffer);
    const supportedPlatforms = fileData.gameVersion.map(version => version.toUpperCase());
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

      throw new Error('[CurseForge File ' + fileData.id + '] Unknown Platform: ' + platform);
    }

    // modJar.bundledMods
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
        throw new Error('Mod file ' + fileData.id + ' is declaring a mod named examplemod');
      }

      // @ts-expect-error
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


    if (mods.length <= 0) {
      return;
    }

    // @ts-expect-error
    const modJar = ModJar.build({
      externalId: generateId(),
      curseProjectId,
      fileName: fileData.displayName,
      curseFileId: fileData.id,
      downloadUrl: fileData.downloadUrl,
      releaseType: getCurseReleaseType(fileData.releaseType),
      releaseDate: fileData.fileDate,
    });

    await this.sequelize.transaction(async transaction => {
      await modJar.save({ transaction });
      await Promise.all(mods.map(mod => {
        mod.jarId = modJar.internalId;

        return mod.save({ transaction });
      }));
    });
  }
}

async function downloadModFile(url) {
  const result = await fetch(url);

  return result.buffer();
}
