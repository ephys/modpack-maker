import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ModModule } from '../mod/mod.module.js';
import { ModpackModResolver } from '../modpack-version/modpack-mod.resolver.js';
import { ModpackVersionModule } from '../modpack-version/modpack-version.module.js';
import { MODPACK_REPOSITORY } from './modpack.constants.js';
import { Modpack } from './modpack.entity.js';
import { ModpackResolver } from './modpack.resolver.js';
import { ModpackService } from './modpack.service.js';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => ModModule),
    forwardRef(() => ModpackVersionModule),
  ],
  exports: [ModpackService],
  providers: [
    ModpackService,
    ModpackResolver,
    ModpackModResolver,
    {
      provide: MODPACK_REPOSITORY,
      useValue: Modpack,
    },
  ],
})
export class ModpackModule {}
