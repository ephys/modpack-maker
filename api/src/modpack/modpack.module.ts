import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ModModule } from '../mod/mod.module';
import { InsertDiscoveredModsProcessor } from './insert-discovered-mods.processor';
import { ModpackModResolver } from './modpack-mod.resolver';
import { MODPACK_REPOSITORY } from './modpack.constants';
import { ModpackController } from './modpack.controller';
import { Modpack } from './modpack.entity';
import { ModpackResolver } from './modpack.resolver';
import { ModpackService } from './modpack.service';

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
