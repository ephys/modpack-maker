import type { ModLoader } from '@ephys/modpack-maker-common/modloaders.js';
import { Inject, Injectable } from '@nestjs/common';
import { Sequelize } from '@sequelize/core';
import { InjectSequelize } from '../database/database.providers.js';
import { ModpackVersion } from '../modpack-version/modpack-version.entity.js';
import { getBySinglePropertyDl } from '../utils/dataloader.js';
import { generateId } from '../utils/generic-utils.js';
import { MODPACK_REPOSITORY } from './modpack.constants.js';
import { Modpack } from './modpack.entity.js';

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
  ) {}

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
