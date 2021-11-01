import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ModVersionRepository } from '../mod/mod.constants';
import { ModModule } from '../mod/mod.module';
import { ProjectResolver } from './project.resolver';
import { ProjectService } from './project.service';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => ModModule),
  ],
  exports: [ProjectService],
  providers: [
    ProjectService,
    ProjectResolver,
    ModVersionRepository,
  ],
})
export class ProjectModule {}
