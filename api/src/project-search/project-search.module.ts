import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ModVersionRepository } from '../mod/mod.constants';
import { ProjectSearchResolver } from './project-search.resolver';
import { ProjectSearchService } from './project-search.service';

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
