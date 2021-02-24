import { Injectable, Inject } from '@nestjs/common';
import { Modpack } from './modpack.entity';
import { MODPACK_REPOSITORY } from './modpack.constants';
import { generateId } from '../utils/generic-utils';
import { ModLoader } from '../../../common/modloaders';
import { ModDiscoveryService } from '../mod/mod-discovery.service';
import { uniq } from 'lodash';
import { ModVersion } from '../mod/mod-version.entity';
import { Sequelize } from 'sequelize';
import ModpackMod from './modpack-mod.entity';

type TCreateModpackInput = {
  name: string,
  modLoader: ModLoader,
  minecraftVersion: string,
};

@Injectable()
export class ModpackService {
  constructor(
    @Inject(MODPACK_REPOSITORY) private modpackRepository: typeof Modpack,
    private modDiscoveryService: ModDiscoveryService,
  ) {}

  async getModpacks(): Promise<Modpack[]> {
    return this.modpackRepository.findAll<Modpack>();
  }

  async createModpack(input: TCreateModpackInput): Promise<Modpack> {
    // @ts-ignore
    return Modpack.create({
      ...input,
      externalId: generateId(),
    });
  }

  getModpackByEid(externalId: string) {
    return Modpack.findOne({ where: { externalId }});
  }

  async addModUrlsToModpack(modpack: Modpack, byUrl: string[]): Promise<Modpack> {
    // TODO: transaction

    const { modIds, curseProjectIds, unknownUrls } = await this.modDiscoveryService.discoverUrls(byUrl);

    if (curseProjectIds.length > 0) {
      modpack.pendingCurseForgeProjectIds = uniq([...modpack.pendingCurseForgeProjectIds, ...curseProjectIds])
    }

    await Promise.all(modIds.map(modId => this.addModToModpack(modpack, modId)));

    // TODO: return unknownUrls to front

    return modpack.save();
  }

  /**
   * Adds our best matching available mod version to the modpack
   *
   * It tries to find one using the following criteria
   * - A version that matches the minecraft version
   * - A version that matches the modLoader
   * - STABLE first, then BETA, then ALPHA
   * - The most recent file
   *
   * @param {Modpack} modpack
   * @param {string} modId
   * @returns {Promise<void>}
   */
  async addModToModpack(modpack: Modpack, modId: string): Promise<Modpack> {

    // TODO: forbid adding the same modId twice

    const mod = await ModVersion.findOne({
      attributes: ['internalId'],
      where: {
        modId,
      },
      // TODO: dynamic parameters
      // TODO: add all valid minecraft versions, with
      //  - modpack MC version first
      //  - else those before that version but same MC MAJOR
      //  - else any other
      order: Sequelize.literal(`
        "supportedMinecraftVersions"::text[] @> ARRAY['1.16.4'] DESC,
        -- other valid MC versions here
        "supportedModLoaders"::text[] @> ARRAY['FORGE'] DESC,
        "releaseType" = 'STABLE' DESC,
        "releaseType" = 'BETA' DESC,
        "releaseType" = 'ALPHA' DESC,
        "releaseDate" DESC
      `),
    });

    if (!mod) {
      throw new Error(`Could not find any valid mod for ${modId}`);
    }

    // @ts-ignore
    await ModpackMod.create({
      modpackId: modpack.internalId,
      modId: mod.internalId,
    });

    return modpack;
  }

  async getModpackMods(modpack: Modpack): Promise<ModVersion[]> {
    return ModVersion.findAll({
      include: [{
        association: ModVersion.associations.inModpacks,
        required: true,
        include: [{
          association: ModpackMod.associations.modpack,
          required: true,
          where: {
            internalId: modpack.internalId,
          },
        }],
      }]
    })
  }
}
