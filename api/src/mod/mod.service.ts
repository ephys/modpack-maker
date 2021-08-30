import * as fsCb from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import * as DataLoader from 'dataloader';
import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import type { ModLoader } from '../../../common/modloaders';
import type { TCurseProject } from '../curseforge.api';
import { getCurseForgeProjects } from '../curseforge.api';
import { ModJar } from './mod-jar.entity';
import type { ModVersion } from './mod-version.entity';

const jarCacheDir = path.join(__dirname, '..', '.jar-files');

@Injectable()
class ModService {

  async getModsInJar(jar: ModJar, filters?: { modLoader?: ModLoader }): Promise<ModVersion[]> {
    const modLoader = filters?.modLoader;

    // TODO: use DataLoader
    const mods: ModVersion[] = await jar.$get('mods');

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
      fileRes.body.pipe(fsCb.createWriteStream(`${cachedFilePath}.part`))
        .on('finish', () => {
          resolve();
        })
        .on('error', reject);
    });

    await fs.rename(`${cachedFilePath}.part`, cachedFilePath);

    return cachedFilePath;
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
