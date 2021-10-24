import * as assert from 'assert';
import { Sequelize } from 'sequelize';
import { InjectSequelize } from '../database/database.providers';
import type { ModJar } from '../mod/mod-jar.entity';
import type { Modpack } from '../modpack/modpack.entity';
import ModpackMod from './modpack-mod.entity';
import { ModpackVersion } from './modpack-version.entity';

export class ModpackVersionService {
  constructor(
    @InjectSequelize private readonly sequelize: Sequelize,
  ) {}

  async getModpackVersionByEid(externalId: string): Promise<ModpackVersion | null> {
    return ModpackVersion.findOne({
      where: {
        externalId,
      },
    });
  }

  async getLastModpackVersion(modpack: Modpack): Promise<ModpackVersion> {
    const out = await this.getModpackVersion(modpack, modpack.lastVersionIndex);

    assert(out != null);

    return out;
  }

  async getModpackVersion(modpack: Modpack, index: number): Promise<ModpackVersion | null> {
    // TODO: dataloader
    return ModpackVersion.findOne({
      where: {
        modpackId: modpack.internalId,
        versionIndex: index,
      },
    });
  }

  async getModpackVersionInstalledJars(modpack: ModpackVersion): Promise<ModpackMod[]> {
    return modpack.$get('installedMods', {
      include: [{
        association: ModpackMod.associations.jar,
      }],
      order: [['createdAt', 'ASC']],
    });
  }

  async removeJarFromModpack(modpack: ModpackVersion, jar: ModJar) {
    return ModpackMod.destroy({
      where: {
        modpackVersionId: modpack.internalId,
        jarId: jar.internalId,
      },
    });
  }

  async setModpackJarIsLibrary(modpack: ModpackVersion, jar: ModJar, isLibrary: boolean) {
    const modpackMod: ModpackMod | null = await ModpackMod.findOne({
      where: {
        modpackVersionId: modpack.internalId,
        jarId: jar.internalId,
      },
    });

    if (modpackMod == null) {
      return null;
    }

    if (modpackMod.isLibraryDependency !== isLibrary) {
      modpackMod.isLibraryDependency = isLibrary;
      await modpackMod.save();
    }

    return modpackMod;
  }

  async replaceModpackJar(modpack: ModpackVersion, oldJar: ModJar, newJar: ModJar): Promise<void> {
    return this.sequelize.transaction(async transaction => {
      const oldInstalledJar: ModpackMod | null = await ModpackMod.findOne({
        where: {
          jarId: oldJar.internalId,
          modpackVersionId: modpack.internalId,
        },
        transaction,
      });

      if (!oldInstalledJar) {
        // TODO: throw ServiceError
        throw new Error('Old jar missing');
      }

      await Promise.all([
        ModpackMod.create({
          jarId: newJar.internalId,
          modpackVersionId: modpack.internalId,
          createdAt: oldInstalledJar.createdAt,
          isLibraryDependency: oldInstalledJar.isLibraryDependency,
        }, { transaction }),
        oldInstalledJar.destroy({ transaction }),
      ]);
    });
  }
}
