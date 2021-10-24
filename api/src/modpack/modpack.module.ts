import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ModModule } from '../mod/mod.module';
import { ModpackModResolver } from '../modpack-version/modpack-mod.resolver';
import { ModpackVersionModule } from '../modpack-version/modpack-version.module';
import { MODPACK_REPOSITORY } from './modpack.constants';
import { ModpackController } from './modpack.controller';
import { Modpack } from './modpack.entity';
import { ModpackResolver } from './modpack.resolver';
import { ModpackService } from './modpack.service';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => ModModule),
    forwardRef(() => ModpackVersionModule),
  ],
  exports: [ModpackService],
  controllers: [ModpackController],
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
