import { Inject, Injectable } from '@nestjs/common';
import type { ModLoader } from '../../../common/modloaders';
import { InjectSequelize } from '../database/database.providers';
import { Sequelize } from '../esm-compat/sequelize-esm';
import { ModpackVersion } from '../modpack-version/modpack-version.entity';
import { getBySinglePropertyDl } from '../utils/dataloader';
import { generateId } from '../utils/generic-utils';
import { MODPACK_REPOSITORY } from './modpack.constants';
import { Modpack } from './modpack.entity';

type TCreateModpackInput = {
  name: string,
  modLoader: ModLoader,
  minecraftVersion: string,
};

@Injectable()
export class ModpackService {
  constructor(
    @Inject(MODPACK_REPOSITORY) private readonly modpackRepository: typeof Modpack,
    @InjectSequelize private readonly sequelize: Sequelize,
  ) {
  }

  getModpackByEid = getBySinglePropertyDl(Modpack, 'externalId');
  getModpackByIid = getBySinglePropertyDl(Modpack, 'internalId');

  async getModpacks(): Promise<Modpack[]> {
    return this.modpackRepository.findAll<Modpack>();
  }

  async createModpack(input: TCreateModpackInput): Promise<Modpack> {
    return this.sequelize.transaction(async () => {
      const modpack = await Modpack.create({
        ...input,
        externalId: generateId(),
      });

      await ModpackVersion.create({
        externalId: generateId(),
        modpackId: modpack.internalId,
        name: 'Initial version',
        versionIndex: 0,
      });

      return modpack;
    });
  }
}
