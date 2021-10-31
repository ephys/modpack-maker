import fsCb from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import uniq from 'lodash/uniq.js';
import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import type { WhereOptions } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import minecraftVersions from '../../../common/minecraft-versions.json';
import type { ModLoader } from '../../../common/modloaders';
import type { TCurseProject } from '../curseforge.api';
import { getCurseForgeProjects } from '../curseforge.api';
import { InjectSequelize } from '../database/database.providers';
import { QueryTypes } from '../esm-compat/sequelize-esm';
import { getPreferredMinecraftVersions } from '../modpack/modpack.service';
import { overlaps } from '../utils/generic-utils';
import { minecraftVersionComparator } from '../utils/minecraft-utils';
import { and, buildWhereComponent, isIn, or, overlap } from '../utils/sequelize-utils';
import { ModJar } from './mod-jar.entity';
import { ModVersion } from './mod-version.entity';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jarCacheDir = path.join(__dirname, '..', '.jar-files');

@Injectable()
class ModService {

  constructor(@InjectSequelize private readonly sequelize: Sequelize) {
  }

  #getModsInJarDataLoader = new DataLoader<number, ModVersion[]>(async keys => {
    const versions = await ModVersion.findAll({
      where: {
        jarId: isIn(keys),
      },
    });

    return keys.map(key => {
      return versions.filter(version => {
        return version.jarId === key;
      });
    });
  });

  async getModsInJar(jar: ModJar, filters?: { modLoader?: ModLoader }): Promise<ModVersion[]> {
    const modLoader = filters?.modLoader;

    const mods: ModVersion[] = await this.#getModsInJarDataLoader.load(jar.internalId);

    if (!modLoader) {
      return mods;
    }

    if (mods.find(mod => mod.supportedModLoader === modLoader)) {
      return mods.filter(mod => mod.supportedModLoader === modLoader);
    }

    return mods;
  }

  async getJar(jarId: string): Promise<ModJar | null> {
    return ModJar.findOne({
      where: {
        externalId: jarId,
      },
    });
  }

  #getCurseForgeProjectDataLoader = new DataLoader<number, TCurseProject | null>(async (curseProjectIds: number[]) => {
    const projects = await getCurseForgeProjects(curseProjectIds);

    return curseProjectIds.map(id => {
      return projects.find(project => project.id === id) ?? null;
    });
  });

  async getCurseForgeProjectUrl(curseProjectId: number): Promise<string> {
    return (await this.#getCurseForgeProjectDataLoader.load(curseProjectId))?.websiteUrl ?? '';
  }

  async downloadJarToFileStream(jar: ModJar): Promise<NodeJS.ReadableStream> {
    let cachedFilePath = await this.getCachedJarPath(jar);
    if (!cachedFilePath) {
      const fileRes = await fetch(jar.downloadUrl);
      // Currently, we download & pipe to disk, then read file & pipe to REST response
      // I wanted to return the stream sooner (as soon as download from curse is ready) but it comes with headache
      // that only benefits initial download
      // if someone else wants to take a stab at it, PR welcome.
      cachedFilePath = await this.cacheJar(jar, fileRes);
    }

    return fsCb.createReadStream(cachedFilePath);
  }

  /**
   * @param {ModJar} jar
   * @returns {Promise<string>} the file path to the cached version
   */
  async downloadJarToFsPath(jar: ModJar): Promise<string> {
    const filePath = await this.getCachedJarPath(jar);
    if (filePath != null) {
      return filePath;
    }

    const fileRes = await fetch(jar.downloadUrl);

    return this.cacheJar(jar, fileRes);
  }

  private async getCachedJarPath(jar: ModJar): Promise<string | null> {
    const cachedFilePath = path.join(jarCacheDir, `${jar.externalId}.jar`);

    const cacheExists = await fileExists(cachedFilePath);

    if (cacheExists) {
      return cachedFilePath;
    }

    return null;
  }

  private async cacheJar(jar: ModJar, fileRes: Response): Promise<string> {
    await fs.mkdir(jarCacheDir, { recursive: true });
    const cachedFilePath = path.join(jarCacheDir, `${jar.externalId}.jar`);

    await new Promise<void>((resolve, reject) => {
      if (!fileRes.body) {
        reject(new Error('fileRes has no body'));

        return;
      }

      fileRes.body.pipe(fsCb.createWriteStream(`${cachedFilePath}.part`))
        .on('finish', () => {
          resolve();
        })
        .on('error', reject);
    });

    await fs.rename(`${cachedFilePath}.part`, cachedFilePath);

    return cachedFilePath;
  }

  #findJarUpdatesDl = new DataLoader<
    [modId: string, projectId: number, modLoader: ModLoader, minecraftVersion: string], ModJar | null
  >(async keys => {
    const minecraftVersionFilters: Map<string, string[]> = new Map();
    const queries: WhereOptions[] = [];

    for (const key of keys) {
      const acceptedMinecraftVersions = minecraftVersionFilters.get(key[3])
        ?? getPreferredMinecraftVersions(key[3], minecraftVersions);
      minecraftVersionFilters.set(key[3], acceptedMinecraftVersions);

      queries.push(and({
        '$mv.modId$': key[0],
        '$j.projectId$': key[1],
        '$mv.supportedModLoader$': key[2],
      }, Sequelize.where(
        Sequelize.cast(Sequelize.col('mv.supportedMinecraftVersions'), 'text[]'),
        // @ts-expect-error
        overlap(...acceptedMinecraftVersions),
      )));
    }

    const allAcceptedMinecraftVersions: string[] = uniq(Array.from(minecraftVersionFilters.values()).flat())
      .sort(minecraftVersionComparator('DESC'));

    const out = await this.sequelize.query(`
SELECT rank() OVER (
  PARTITION BY mv."modId", j."projectId", mv."supportedModLoader",
    ${Array.from(minecraftVersionFilters.values()).map(minecraftVersionFilter => {
      const versionArray = minecraftVersionFilter.map(v => `'${v}'`).join(',');

      return `mv."supportedMinecraftVersions"::text[] && ARRAY [${versionArray}]`;
    }).join(', ')}
  ORDER BY 
    ${allAcceptedMinecraftVersions.map((_version, index) => {
      const versions: string[] = [];
      for (let i = 0; i <= index; i++) {
        versions.push(allAcceptedMinecraftVersions[i]);
      }

      const versionStr = versions.map(v => `'${v}'`).join(',');

      // We generate something that looks like: (modpack is 1.16.5)
      //   ORDER BY v."supportedMinecraftVersions"::text[] && ARRAY ['1.16.5'] DESC,
      //     v."supportedMinecraftVersions"::text[] && ARRAY ['1.16.5', '1.16.4'] DESC,
      //     v."supportedMinecraftVersions"::text[] && ARRAY ['1.16.5', '1.16.4', '1.16.3'] DESC,
      // We have to repeat previous version in the overlap, otherwise
      //  a version that that supports 1.16.5 + 1.16.3 but was released *before*
      //  a version that only supports 1.16.5 would be selected.

      return `mv."supportedMinecraftVersions"::text[] && ARRAY[${versionStr}] DESC`;
    }).join(', ')},
    j."releaseType" = 'STABLE' DESC,
    j."releaseType" = 'BETA' DESC,
    j."releaseType" = 'ALPHA' DESC,
    j."releaseDate" DESC
) rank, mv."modId",  mv."supportedModLoader", mv."supportedMinecraftVersions", j.*
FROM "ModJars" j
  INNER JOIN "ModVersions" mv ON mv."jarId" = j."internalId"
WHERE ${buildWhereComponent(or(...queries), ModJar, 'j')}
ORDER BY rank, mv."modId", j."projectId", mv."supportedModLoader", mv."supportedMinecraftVersions"
LIMIT ${keys.length};
    `, {
      type: QueryTypes.SELECT,
      mapToModel: true,
      model: ModJar,
    });

    return keys.map(key => {
      const [modId, projectId, modLoader, minecraftVersion] = key;
      const acceptedMinecraftVersions = minecraftVersionFilters.get(minecraftVersion)!;

      return out.find(jar => {
        if (jar.get('rank') !== '1') {
          return false;
        }

        if (jar.get('modId') !== modId) {
          return false;
        }

        if (jar.projectId !== projectId) {
          return false;
        }

        if (jar.get('supportedModLoader') !== modLoader) {
          return false;
        }

        if (!overlaps(jar.get('supportedMinecraftVersions') as string[], acceptedMinecraftVersions)) {
          return false;
        }

        return true;
      }) ?? null;
    });
  });

  async findJarUpdates(jar: ModJar, minecraftVersion: string, modLoader: ModLoader): Promise<ModJar[]> {
    const mods = await this.getModsInJar(jar, { modLoader });

    // @ts-expect-error
    const result: ModJar[] = (await Promise.all(
      mods.map(async mod => this.#findJarUpdatesDl.load([mod.modId, jar.projectId, modLoader, minecraftVersion])),
    )).filter(val => val != null);

    if (result.length === 1 && result[0].internalId === jar.internalId) {
      return [];
    }

    return result;
  }
}

async function fileExists(file) {
  try {
    return (await fs.stat(file)).isFile();
  } catch (e) {
    if (e.code === 'ENOENT') {
      return false;
    }

    throw e;
  }
}

export { ModService };
