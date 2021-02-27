import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { getCurseForgeModFiles, getCurseReleaseType, TCurseFile } from '../curseforge.api';
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
import { CurseforgeProject } from './curseforge-project.entity';
import { FETCH_CURSE_FILES_QUEUE } from './mod.constants';

// TODO: every 15 minutes, if queue is empty, fill it with every mod that is in a modpack & whose versionListUpToDate is false

@Processor(FETCH_CURSE_FILES_QUEUE)
export class CurseforgeFileCrawlerProcessor {
  private readonly logger = new Logger(CurseforgeFileCrawlerProcessor.name);

  constructor(
    @InjectQueue(INSERT_DISCOVERED_MODS_QUEUE) private insertDiscoveredModsQueue: Queue,
    @InjectSequelize private readonly sequelize: Sequelize,
  ) {
  }

  @Process({
    concurrency: 10,
  })
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
        console.error(e.message);

        const cfProject = await CurseforgeProject.findOne({
          where: { forgeId: curseProjectId },
        });

        if (!cfProject.failedFileIds.includes(file.id)) {
          cfProject.failedFileIds = [
            ...cfProject.failedFileIds,
            file.id,
          ];

          await cfProject.save();
        }
      }
    }

    await Promise.all([
      CurseforgeProject.update({
        versionListUpToDate: true,
      }, {
        where: {
          forgeId: curseProjectId,
        },
      }),
      this.insertDiscoveredModsQueue.add(curseProjectId),
    ]);
  }

  private async processFile(fileData: TCurseFile, curseProjectId: number): Promise<void> {
    // mods that I could not fix myself
    const blackList = [
      // chimes (https://www.curseforge.com/minecraft/mc-mods/chimes/files)
      // Up to Chimes-1.16.3-0.9.6.jar has a syntax error in mods.toml
      3113012, 3133542, 3106377, 3189454, 3122566, 3195111,

      // Architectury API (Forge)
      // https://www.curseforge.com/minecraft/mc-mods/architectury-forge/files
      // These files are missing a version
      3112385, 3115335, 3112376, 3114260, 3114302, 3112341, 3118765, 3118805,

      // Charm
      // These are for snapshots, can safely ignore them
      3110770,

      // NoExpensive
      // Snapshot mod
      2972766,

      // Dude! Where's my Horse?
      // https://www.curseforge.com/minecraft/mc-mods/dude-wheres-my-horse/files/2913880
      // Version Missing
      2913880,

      // True Darkness
      // Snapshot
      2899752, 2958683, 2970433,

      // https://www.curseforge.com/minecraft/mc-mods/waystones
      // Has mods.toml but is actually a 1.12.2 mod
      2859214,

      // Industrial foregoing
      // No version
      2713265,
    ];

    if (blackList.includes(fileData.id)) {
      return;
    }

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
      fileName: fileData.fileName,
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
