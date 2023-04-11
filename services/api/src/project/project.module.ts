import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ModVersionRepository } from '../mod/mod.constants.js';
import { ModModule } from '../mod/mod.module.js';
import { ProjectResolver } from './project.resolver.js';
import { ProjectService } from './project.service.js';

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
