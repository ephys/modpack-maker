import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { getCurseForgeModFiles, getCurseReleaseType, TForgeFile } from '../curseforge.api';
import { ModVersion } from './mod-version.entity';
import { Op } from 'sequelize';
import fetch from 'node-fetch';
import { getModMetaFromJar } from '../mod-jar-data-extraction/mod-data-extractor';
import * as minecraftVersion from '../../../common/minecraft-versions.json';
import { ModLoader } from '../../../common/modloaders';
import { INSERT_DISCOVERED_MODS_QUEUE } from '../modpack/modpack.constants';
import { getMinecraftVersionsInRange } from '../utils/minecraft-utils';

// TODO: every 15 minutes, if queue is empty, fill it with every mod that is in a modpack & whose versionListUpToDate is false

@Processor('fetch-curse-project-files')
export class CurseforgeFileCrawlerProcessor {
  private readonly logger = new Logger(CurseforgeFileCrawlerProcessor.name);

  constructor(@InjectQueue(INSERT_DISCOVERED_MODS_QUEUE) private insertDiscoveredModsQueue: Queue) {}

  @Process()
  async fetchCurseProjectFiles(job: Job<number>) {
    const curseProjectId = job.data;
    console.log('Processing CurseForge mod ' + curseProjectId);

    const files = await getCurseForgeModFiles(curseProjectId);

    const fileIds = [];

    for (const file of files) {
      fileIds.push(file.id);
    }

    const existingFiles = await ModVersion.findAll({
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
        const processedData = await this.processFile(file, curseProjectId);

        // @ts-ignore
        await ModVersion.create(processedData);
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

    const meta = await getModMetaFromJar(fileBuffer);

    const supportedPlatforms = fileData.gameVersion.map(version => version.toUpperCase());
    const supportedMcVersions = new Set();

    // FIXME: we tried extracting it but a lot of mod are declaring their version as >=1.x
    //  meaning the following Major version is considered valid
    //  For mods coming from curse, we'll just use the curse list
    //  If we start uploading mods ourselves, we'll warn the user if their version range is fishy (ie. unbound)
    // if (meta.minecraftVersionRange) {
    //   // denormalize version range for easier DB querying
    //   for (const version of getMinecraftVersionsInRange(meta.minecraftVersionRange)) {
    //     supportedMcVersions.add(version);
    //   }
    // }

    let curseMetaModLoader = null;
    for (const platform of supportedPlatforms) {
      if (minecraftVersion.includes(platform)) {
        supportedMcVersions.add(platform);
        continue;
      }

      if (Object.keys(ModLoader).includes(platform)) {
        if (curseMetaModLoader) {
          throw new Error('[CurseForge File ' + fileData.id + '] declared supporting two modLoaders: ' + curseMetaModLoader + ' & ' + platform)
        }

        curseMetaModLoader = platform;
        continue;
      }

      if (platform.endsWith('-SNAPSHOT')) {
        continue;
      }

      throw new Error('[CurseForge File ' + fileData.id + '] Unknown Platform: ' + platform);
    }

    if (meta.loader && curseMetaModLoader && meta.loader !== curseMetaModLoader) {
      throw new Error('[CurseForge File ' + fileData.id + '] Platform mismatch between curseforge & file jar');
    }

    // forbid uploading the default project mod name.
    if (meta.modId === 'examplemod') {
      throw new Error('Mod file ' + fileData.id + ' is declaring a mod named examplemod');
    }

    return {
      modId: meta.modId,
      displayName: meta.name,
      modVersion: meta.version,
      supportedMinecraftVersions: Array.from(supportedMcVersions),
      // FIXME: we tried extracting it but a lot of mod are declaring their version as >=1.x
      //  meaning the following Major version is considered valid
      //  For mods coming from curse, we'll just use the curse list
      //  If we start uploading mods ourselves, we'll warn the user if their version range is fishy (ie. unbound)
      supportedMinecraftVersionRange: '', // meta.minecraftVersionRange,
      supportedModLoaders: [meta.loader || curseMetaModLoader],
      curseFileId: fileData.id,
      curseProjectId,
      downloadUrl: fileData.downloadUrl,
      releaseDate: fileData.fileDate,
      releaseType: getCurseReleaseType(fileData.releaseType),
      dependencies: meta.dependencies || [],
    };
  }
}

async function downloadModFile(url) {
  const result = await fetch(url);

  return result.buffer();
}
