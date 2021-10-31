import assert from 'assert';
import { InjectSequelize } from '../database/database.providers';
import { QueryTypes, Sequelize } from '../esm-compat/sequelize-esm';
import type { ModJar } from '../mod/mod-jar.entity';
import type { Modpack } from '../modpack/modpack.entity';
import { ModpackService } from '../modpack/modpack.service';
import { generateId } from '../utils/generic-utils';
import ModpackMod from './modpack-mod.entity';
import { ModpackVersion } from './modpack-version.entity';

export class ModpackVersionService {
  constructor(
    @InjectSequelize private readonly sequelize: Sequelize,
    private readonly modpackService: ModpackService,
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

  async getModpackVersionModpack(modpackVersion: ModpackVersion): Promise<Modpack> {
    const modpack = await this.modpackService.getModpackByIid(modpackVersion.modpackId);
    assert(modpack != null);

    return modpack;
  }

  async createNewVersion(oldVersion: ModpackVersion, name: string): Promise<ModpackVersion> {
    return this.sequelize.transaction(async () => {
      const modpack = await this.getModpackVersionModpack(oldVersion);

      modpack.lastVersionIndex += 1;

      const [newVersion] = await Promise.all([
        ModpackVersion.create({
          externalId: generateId(),
          modpackId: modpack.internalId,
          versionIndex: modpack.lastVersionIndex,
          name,
        }),
        modpack.save(),
      ]);

      // language=PostgreSQL
      await this.sequelize.query(`
        INSERT INTO "ModpackMods" ("modpackVersionId", "jarId", "createdAt", "updatedAt", "isLibraryDependency") 
          (
            SELECT :newVersionId, "jarId", "createdAt", now(), "isLibraryDependency" 
            FROM "ModpackMods"
            WHERE "modpackVersionId" = :oldVersionId
          )
      `, {
        type: QueryTypes.INSERT,
        replacements: {
          newVersionId: newVersion.internalId,
          oldVersionId: oldVersion.internalId,
        },
      });

      return newVersion;
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

  async replaceModpackJar(modpack: ModpackVersion, oldJar: ModJar, newJars: ModJar[]): Promise<void> {
    return this.sequelize.transaction(async () => {
      const oldInstalledJar: ModpackMod | null = await ModpackMod.findOne({
        where: {
          jarId: oldJar.internalId,
          modpackVersionId: modpack.internalId,
        },
      });

      if (!oldInstalledJar) {
        // TODO: throw ServiceError
        throw new Error('Old jar missing');
      }

      await Promise.all([
        oldInstalledJar.destroy(),
        ...newJars.map(async jar => {
          await ModpackMod.create({
            jarId: jar.internalId,
            modpackVersionId: modpack.internalId,
            createdAt: oldInstalledJar.createdAt,
            isLibraryDependency: oldInstalledJar.isLibraryDependency,
          });
        }),
      ]);
    });
  }
}
