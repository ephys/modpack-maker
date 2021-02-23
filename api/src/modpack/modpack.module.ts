import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MODPACK_REPOSITORY } from './modpack.constants';
import { Modpack } from './modpack.entity';
import { ModpackService } from './modpack.service';
import { ModpackResolver } from './modpack.resolver';

const catsProviders = [
  {
    provide: MODPACK_REPOSITORY,
    useValue: Modpack,
  },
];

@Module({
  imports: [DatabaseModule],
  providers: [
    ModpackService,
    ModpackResolver,
    ...catsProviders,
  ],
})
export class ModpackModule {}
