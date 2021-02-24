import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { getCurseForgeModFiles, getCurseReleaseType, TForgeFile } from '../curseforge.api';
import { ModVersion } from './mod-version.entity';
import { Op } from 'sequelize';
import fetch from 'node-fetch';
import { getModMetaFromJar } from '../mod-data-extractor';
import * as minecraftVersion from '../../../common/minecraft-versions.json';
import { ModLoader } from '../../../common/modloaders';

// TODO: every 15 minutes, if queue is empty, fill it with every mod that is in a modpack & whose versionListUpToDate is false

// TODO: extract MC version from Jar (using loaderVersion and mod.deps)
// TODO: extract forge version from Jar (either mod.deps and loaderVersion)
// TODO: extract other mod (required) deps

enum CurseReleaseType {
  RELEASE = 1,
  BETA = 2,
  ALPHA = 3,
}

@Processor('fetch-curse-project-files')
export class CurseforgeFileCrawlerProcessor {
  private readonly logger = new Logger(CurseforgeFileCrawlerProcessor.name);

  @Process()
  async fetchCurseProjectFiles(job: Job<number>) {
    console.log('Processing CurseForge mod ' + job.data);

    const files = await getCurseForgeModFiles(job.data);

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
        const processedData = await this.processFile(file);

        // @ts-ignore
        await ModVersion.create(processedData);
      } catch (e) {
        console.error('Processing Curse file ' + file.id + ' failed:');
        console.error(e);

        return;
      }
    }

    // -> get files
    // -> for each file: Skip if ModVersionEntity exists for that file
    // -> else download the file
    // -> extract meta like in https://github.com/Ephys/mc-curseforge-updateJSONURL/blob/main/index.js
    //   -> file.gameVersion (array): 1.6.4, Forge, Fabric
    //   -> releaseType
    // -> create ModVersionEntity (+ ModEntity if it does not exist, but maybe it will be dropped)
    // -> remove file from all ModpackEntity queuedUrls
    // -> add ModVersionEntity to ModpackEntities using best fit: We always link a file, even if not compatible
    //  -> most recent stable file for that version + modloader
    //  -> if no stable, fallback to beta
    //  -> else, fallback to alpha
    //  -> else, fallback to most recent file in same minecraft version
    //  -> else, fallback to most recent file

    // TODO: dependencies
    // TODO: release date
  }

  private async processFile(fileData: TForgeFile) {
    const fileBuffer = await downloadModFile(fileData.downloadUrl);

    const meta = await getModMetaFromJar(fileBuffer);

    const supportedPlatforms = fileData.gameVersion.map(version => version.toUpperCase());
    const supportedMcVersions = new Set();
    if (meta.mcVersion) {
      supportedMcVersions.add(meta.mcVersion);
    }

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
      // TODO: extract from Jar & use range
      supportedMinecraftVersions: Array.from(supportedMcVersions),
      supportedModLoaders: [meta.loader || curseMetaModLoader],
      curseFileId: fileData.id,
      downloadUrl: fileData.downloadUrl,
      releaseDate: fileData.fileDate,
      releaseType: getCurseReleaseType(fileData.releaseType),
    };
  }
}

async function downloadModFile(url) {
  const result = await fetch(url);

  return result.buffer();
}
