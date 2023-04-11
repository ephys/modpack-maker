import { BullModule } from '@nestjs/bull';
import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ModpackModule } from '../modpack/modpack.module.js';
import { ProjectModule } from '../project/project.module.js';
import { CurseforgeJarCrawlerProcessor } from './curseforge-jar-crawler.processor.js';
import { CurseforgeProjectListCrawler } from './curseforge-project-list-crawler.js';
import { ModDiscoveryService } from './mod-discovery.service.js';
import { ModJarResolver } from './mod-jar.resolver.js';
import { ModVersionResolver } from './mod-version.resolver.js';
import { FETCH_CURSE_JARS_QUEUE, FETCH_MODRINTH_JARS_QUEUE, ModVersionRepository } from './mod.constants.js';
import { ModController } from './mod.controller.js';
import { ModService } from './mod.service.js';
import { ModrinthJarCrawlerProcessor } from './modrinth-jar-crawler.processor.js';
import { ModrinthProjectListCrawler } from './modrinth-project-list-crawler.js';

@Module({
  imports: [
    forwardRef(() => ModpackModule),
    DatabaseModule,
    BullModule.registerQueue({
      name: FETCH_CURSE_JARS_QUEUE,
    }),
    BullModule.registerQueue({
      name: FETCH_MODRINTH_JARS_QUEUE,
      limiter: {
        max: 100,
        duration: 60_000,
      },
    }),
    forwardRef(() => ProjectModule),
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
    ModVersionResolver,
    ModService,
    CurseforgeProjectListCrawler,
    ModrinthProjectListCrawler,
    ModVersionRepository,
  ],
})
export class ModModule {}
