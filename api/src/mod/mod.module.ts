import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FETCH_CURSE_FILES_QUEUE, ModVersionRepository } from './mod.constants';
import { ModDiscoveryService } from './mod-discovery.service';
import { BullModule } from '@nestjs/bull';
import { CurseforgeFileCrawlerProcessor } from './curseforge-file-crawler.processor';
import { ProjectListUpdater } from './project-list-updater';
import { INSERT_DISCOVERED_MODS_QUEUE } from '../modpack/modpack.constants';
import { ModJarResolver } from './mod-jar.resolver';
import { ModService } from './mod.service';
import { ModController } from './mod.controller';
import { ModpackModule } from '../modpack/modpack.module';
import { ModResolver } from './mod.resolver';

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
    ModController,
  ],
  providers: [
    CurseforgeFileCrawlerProcessor,
    ModDiscoveryService,
    ModJarResolver,
    ModService,
    ProjectListUpdater,
    ModResolver,
    ModVersionRepository,
  ],
})
export class ModModule {}
