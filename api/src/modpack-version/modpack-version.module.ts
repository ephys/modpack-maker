import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ModModule } from '../mod/mod.module';
import { ModpackModule } from '../modpack/modpack.module';
import { ModpackModResolver } from './modpack-mod.resolver';
import { MODPACK_VERSION_REPOSITORY } from './modpack-version.constants';
import { ModpackVersion } from './modpack-version.entity';
import { ModpackVersionResolver } from './modpack-version.resolver';
import { ModpackVersionService } from './modpack-version.service';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => ModpackModule),
    forwardRef(() => ModModule),
  ],
  exports: [ModpackVersionService],
  providers: [
    ModpackVersionService,
    ModpackVersionResolver,
    ModpackModResolver,
    {
      provide: MODPACK_VERSION_REPOSITORY,
      useValue: ModpackVersion,
    },
  ],
})
export class ModpackVersionModule {}
