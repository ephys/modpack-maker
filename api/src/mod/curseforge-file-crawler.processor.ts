import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { getCurseForgeModFiles } from '../curseforge.api';

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
    this.logger.log('Fetching files for Curse Project ' + job.data);

    const files = await getCurseForgeModFiles(job.data);

    // -> get files
    // -> for each file: Skip if ModVersionEntity exists for that file
    // -> else download the file
    // -> extract meta like in https://github.com/Ephys/mc-curseforge-updateJSONURL/blob/main/index.js
    //   -> name
    //   -> modVersion
    //   -> modid
    //   -> downloadUrl
    //   -> file.gameVersion (array): 1.6.4, Forge, Fabric
    //   -> curseFileId
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

    console.dir(files, {
      depth: 10,
      colors: true,
    });
  }
}

// [start:dev:app]   {
//   [start:dev:app]     id: 2209879,
//     [start:dev:app]     displayName: 'SoundFilters-0.2_beta.jar',
//     [start:dev:app]     fileName: 'SoundFilters-0.2_beta.jar',
//     [start:dev:app]     fileDate: '2014-07-28T18:17:05.067Z',
//     [start:dev:app]     fileLength: 34586,
//     [start:dev:app]     releaseType: 2,
//     [start:dev:app]     fileStatus: 4,
//     [start:dev:app]     downloadUrl: 'https://edge.forgecdn.net/files/2209/879/SoundFilters-0.2_beta.jar',
//     [start:dev:app]     isAlternate: false,
//     [start:dev:app]     alternateFileId: 0,
//     [start:dev:app]     dependencies: [],
//     [start:dev:app]     isAvailable: true,
//     [start:dev:app]     modules: [],
//     [start:dev:app]     packageFingerprint: 4049317632,
//     [start:dev:app]     gameVersion: [ '1.6.4' ],
//     [start:dev:app]     installMetadata: null,
//     [start:dev:app]     serverPackFileId: null,
//     [start:dev:app]     hasInstallScript: false,
//     [start:dev:app]     gameVersionDateReleased: '2013-09-19T00:00:00Z',
//     [start:dev:app]     gameVersionFlavor: null
//     [start:dev:app]   }
