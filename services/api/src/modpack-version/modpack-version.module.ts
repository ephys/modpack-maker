import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ModModule } from '../mod/mod.module.js';
import { ModpackModule } from '../modpack/modpack.module.js';
import { ModpackModResolver } from './modpack-mod.resolver.js';
import { ModpackVersionDownloaderController } from './modpack-version-downloader.controller.js';
import { ModpackVersionDownloaderService } from './modpack-version-downloader.service.js';
import { MODPACK_VERSION_REPOSITORY } from './modpack-version.constants.js';
import { ModpackVersion } from './modpack-version.entity.js';
import { ModpackVersionResolver } from './modpack-version.resolver.js';
import { ModpackVersionService } from './modpack-version.service.js';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => ModpackModule),
    forwardRef(() => ModModule),
  ],
  exports: [
    ModpackVersionService,
    ModpackVersionDownloaderService,
  ],
  controllers: [ModpackVersionDownloaderController],
  providers: [
    ModpackVersionService,
    ModpackVersionResolver,
    ModpackModResolver,
    ModpackVersionDownloaderService,
    {
      provide: MODPACK_VERSION_REPOSITORY,
      useValue: ModpackVersion,
    },
  ],
})
export class ModpackVersionModule {}
