import { Injectable, Inject } from '@nestjs/common';
import { Modpack } from './modpack.entity';
import { MODPACK_REPOSITORY } from './modpack.constants';
import { generateId } from '../utils/generic-utils';
import { ModLoader } from '../../../common/modloaders';
import { ModDiscoveryService } from '../mod/mod-discovery.service';
import { uniq } from 'lodash';
import { Sequelize } from 'sequelize';
import ModpackMod from './modpack-mod.entity';
import * as minecraftVersions from '../../../common/minecraft-versions.json';
import { minecraftVersionComparator, parseMinecraftVersion } from '../utils/minecraft-utils';
import { ModJar } from '../mod/mod-jar.entity';

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
  ) {
  }

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
    return Modpack.findOne({ where: { externalId } });
  }

  async addModUrlsToModpack(modpack: Modpack, byUrl: string[]): Promise<Modpack> {
    // TODO: transaction

    const { modIds, curseProjectIds, unknownUrls } = await this.modDiscoveryService.discoverUrls(byUrl);

    if (curseProjectIds.length > 0) {
      modpack.pendingCurseForgeProjectIds = uniq([...modpack.pendingCurseForgeProjectIds, ...curseProjectIds]);
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

    const installedModVersion = await ModpackMod.findOne({
      where: {
        modpackId: modpack.internalId,
      },
      include: [{
        association: ModpackMod.associations.jar,
        required: true,
        include: [{
          association: ModJar.associations.mods,
          required: true,
          where: {
            modId,
          },
        }]
      }],
    });

    if (installedModVersion != null) {
      return modpack;
    }

    const validMcVersions = getPreferredMinecraftVersions(modpack.minecraftVersion, minecraftVersions);

    const mod = await ModJar.findOne({
      attributes: ['internalId'],
      include: [{
        association: ModJar.associations.mods,
        required: true,
        where: {
          modId,
        },
      }],
      order: Sequelize.literal(`
        ${validMcVersions.map(mcVersion => {
        return `mods."supportedMinecraftVersions"::text[] @> ARRAY['${mcVersion}'] DESC,\n`;
      }).join('')}
        mods."supportedModLoader" = :modLoader DESC,
        "releaseType" = 'STABLE' DESC,
        "releaseType" = 'BETA' DESC,
        "releaseType" = 'ALPHA' DESC,
        "releaseDate" DESC
      `),
      subQuery: false,
      replacements: {
        modLoader: modpack.modLoader,
      },
    });

    if (!mod) {
      throw new Error(`Could not find any valid mod for ${modId}`);
    }

    // @ts-ignore
    await ModpackMod.create({
      modpackId: modpack.internalId,
      jarId: mod.internalId,
    });

    return modpack;
  }

  getModpackJars(modpack: Modpack): Promise<ModJar[]> {
    return ModJar.findAll({
      include: [{
        association: ModJar.associations.inModpacks,
        required: true,
        include: [{
          association: ModpackMod.associations.modpack,
          required: true,
          where: {
            internalId: modpack.internalId,
          },
        }],
      }],
    });
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

  validMcVersions.sort(minecraftVersionComparator('DESC'));

  return validMcVersions;
}
