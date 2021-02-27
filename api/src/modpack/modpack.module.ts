import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MODPACK_REPOSITORY } from './modpack.constants';
import { Modpack } from './modpack.entity';
import { ModpackService } from './modpack.service';
import { ModpackResolver } from './modpack.resolver';
import { ModModule } from '../mod/mod.module';
import { InsertDiscoveredModsProcessor } from './insert-discovered-mods.processor';
import { ModpackModResolver } from './modpack-mod.resolver';
import { ModpackController } from './modpack.controller';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => ModModule),
  ],
  exports: [ModpackService],
  controllers: [ModpackController],
  providers: [
    ModpackService,
    ModpackResolver,
    ModpackModResolver,
    InsertDiscoveredModsProcessor,
    {
      provide: MODPACK_REPOSITORY,
      useValue: Modpack,
    },
  ],
})
export class ModpackModule {}
