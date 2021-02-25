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
import * as minecraftVersions from '../../../common/minecraft-versions.json';
import { parseMinecraftVersion } from '../utils/minecraft-utils';

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

    const validMcVersions = getPreferredMinecraftVersions(modpack.minecraftVersion, minecraftVersions);

    const mod = await ModVersion.findOne({
      attributes: ['internalId'],
      where: {
        modId,
      },
      order: Sequelize.literal(`
        ${validMcVersions.map(mcVersion => {
          return `"supportedMinecraftVersions"::text[] @> ARRAY['${mcVersion}'] DESC,\n`  
        }).join('')}
        "supportedModLoaders"::text[] @> ARRAY[:modLoader] DESC,
        "releaseType" = 'STABLE' DESC,
        "releaseType" = 'BETA' DESC,
        "releaseType" = 'ALPHA' DESC,
        "releaseDate" DESC
      `),
      replacements: {
        modLoader: modpack.modLoader,
      }
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

export function getPreferredMinecraftVersions(mainVersionStr: string, existingMcVersions: string[]) {
  const validMcVersions = [mainVersionStr];
  const mainVersion = parseMinecraftVersion(mainVersionStr);

  for (const versionStr of existingMcVersions) {
    const version = parseMinecraftVersion(versionStr);

    if (version.major === mainVersion.major && version.minor <= mainVersion.minor) {
      validMcVersions.push(versionStr);
    }
  }

  validMcVersions.sort((aStr, bStr) => {
    const a = parseMinecraftVersion(aStr);
    const b = parseMinecraftVersion(bStr);

    // sort with most recent release first
    if (a.major !== b.major) {
      return b.major - a.major;
    }

    return b.minor - a.minor;
  });

  return validMcVersions;
}
