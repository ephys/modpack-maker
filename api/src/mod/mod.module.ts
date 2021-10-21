import { BullModule } from '@nestjs/bull';
import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { INSERT_DISCOVERED_MODS_QUEUE } from '../modpack/modpack.constants';
import { ModpackModule } from '../modpack/modpack.module';
import { CurseforgeJarCrawlerProcessor } from './curseforge-jar-crawler.processor';
import { CurseforgeProjectListCrawler } from './curseforge-project-list-crawler';
import { ModDiscoveryService } from './mod-discovery.service';
import { ModJarResolver } from './mod-jar.resolver';
import { FETCH_CURSE_JARS_QUEUE, FETCH_MODRINTH_JARS_QUEUE, ModVersionRepository } from './mod.constants';
import { ModController } from './mod.controller';
import { ModResolver } from './mod.resolver';
import { ModService } from './mod.service';
import { ModrinthJarCrawlerProcessor } from './modrinth-jar-crawler.processor';
import { ModrinthProjectListCrawler } from './modrinth-project-list-crawler';
import { ProjectResolver } from './project.resolver';

@Module({
  imports: [
    forwardRef(() => ModpackModule),
    DatabaseModule,
    BullModule.registerQueue({
      name: FETCH_CURSE_JARS_QUEUE,
    }),
    BullModule.registerQueue({
      name: FETCH_MODRINTH_JARS_QUEUE,
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
    CurseforgeJarCrawlerProcessor,
    ModrinthJarCrawlerProcessor,
    ModDiscoveryService,
    ModJarResolver,
    ModService,
    CurseforgeProjectListCrawler,
    ModrinthProjectListCrawler,
    ModResolver,
    ModVersionRepository,
    ProjectResolver,
  ],
})
export class ModModule {}
