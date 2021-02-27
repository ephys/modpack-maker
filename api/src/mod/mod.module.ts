import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FETCH_CURSE_FILES_QUEUE, MOD_VERSION_REPOSITORY } from './mod.constants';
import { ModVersion } from './mod-version.entity';
import { ModDiscoveryService } from './mod-discovery.service';
import { BullModule } from '@nestjs/bull';
import { CurseforgeFileCrawlerProcessor } from './curseforge-file-crawler.processor';
import { CurseforgeSearchCrawlerService } from './curseforge-search-crawler.service';
import { INSERT_DISCOVERED_MODS_QUEUE } from '../modpack/modpack.constants';
import { ModJarResolver } from './mod-jar.resolver';
import { ModService } from './mod.service';
import { CurseforgeFileCrawlerController } from './curseforge-file-crawler.controller';
import { ModpackModule } from '../modpack/modpack.module';

@Module({
  imports: [
    forwardRef(() => ModpackModule),
    DatabaseModule,
    BullModule.registerQueue({
      name: FETCH_CURSE_FILES_QUEUE,
    }),
    BullModule.registerQueue({
      name: INSERT_DISCOVERED_MODS_QUEUE,
    }),
  ],
  exports: [
    ModDiscoveryService,
    ModService,
  ],
  controllers: [
    CurseforgeFileCrawlerController,
  ],
  providers: [
    CurseforgeFileCrawlerProcessor,
    ModDiscoveryService,
    ModJarResolver,
    ModService,
    CurseforgeSearchCrawlerService,
    {
      provide: MOD_VERSION_REPOSITORY,
      useValue: ModVersion,
    },
  ],
})
export class ModModule {}
