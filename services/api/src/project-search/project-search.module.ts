import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ModVersionRepository } from '../mod/mod.constants.js';
import { ProjectSearchResolver } from './project-search.resolver.js';
import { ProjectSearchService } from './project-search.service.js';

@Module({
  imports: [
    DatabaseModule,
  ],
  exports: [ProjectSearchService],
  providers: [
    ProjectSearchService,
    ProjectSearchResolver,
    ModVersionRepository,
  ],
})
export class ProjectSearchModule {}
