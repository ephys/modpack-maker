import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MOD_VERSION_REPOSITORY } from './mod.constants';
import { ModVersion } from './mod-version.entity';
import { ModDiscoveryService } from './mod-discovery.service';
import { BullModule } from '@nestjs/bull';
import { CurseforgeFileCrawlerProcessor } from './curseforge-file-crawler.processor';
import { CurseforgeSearchCrawlerService } from './curseforge-search-crawler.service';
import { INSERT_DISCOVERED_MODS_QUEUE } from '../modpack/modpack.constants';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'fetch-curse-project-files',
    }),
    BullModule.registerQueue({
      name: INSERT_DISCOVERED_MODS_QUEUE,
    }),
  ],
  exports: [
    ModDiscoveryService,
  ],
  providers: [
    CurseforgeFileCrawlerProcessor,
    ModDiscoveryService,
    CurseforgeSearchCrawlerService,
    {
      provide: MOD_VERSION_REPOSITORY,
      useValue: ModVersion,
    },
  ],
})
export class ModModule {}
