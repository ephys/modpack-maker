import { BullModule } from '@nestjs/bull';
import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { INSERT_DISCOVERED_MODS_QUEUE } from '../modpack/modpack.constants';
import { ModpackModule } from '../modpack/modpack.module';
import { CurseforgeFileCrawlerProcessor } from './curseforge-file-crawler.processor';
import { ModDiscoveryService } from './mod-discovery.service';
import { ModJarResolver } from './mod-jar.resolver';
import { FETCH_CURSE_FILES_QUEUE, ModVersionRepository } from './mod.constants';
import { ModController } from './mod.controller';
import { ModResolver } from './mod.resolver';
import { ModService } from './mod.service';
import { ProjectListUpdater } from './project-list-updater';
import { ProjectResolver } from './project.resolver';

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
    ProjectResolver,
  ],
})
export class ModModule {}
