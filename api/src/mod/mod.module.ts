import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MOD_REPOSITORY, MOD_VERSION_REPOSITORY } from './mod.constants';
import { Mod } from './mod.entity';
import { ModVersion } from './mod-version.entity';
import { ModDiscoveryService } from './mod-discovery.service';
import { BullModule } from '@nestjs/bull';
import { CurseforgeFileCrawlerProcessor } from './curseforge-file-crawler.processor';
import { CurseforgeSearchCrawlerService } from './curseforge-search-crawler.service';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'fetch-curse-project-files',
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
      provide: MOD_REPOSITORY,
      useValue: Mod,
    },
    {
      provide: MOD_VERSION_REPOSITORY,
      useValue: ModVersion,
    },
  ],
})
export class ModModule {}
