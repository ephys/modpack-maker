import { Injectable } from '@nestjs/common';
import { ModJar } from './mod-jar.entity';
import { ModVersion } from './mod-version.entity';
import * as DataLoader from 'dataloader';
import { getCurseForgeProjects, TCurseProject } from '../curseforge.api';
import { ModLoader } from '../../../common/modloaders';

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

  getJar(jarId: string): Promise<ModJar | null> {
    return ModJar.findOne({
      where: {
        externalId: jarId,
      }
    });
  }

  #getCurseForgeProjectDataLoader = new DataLoader<number, TCurseProject>(async (curseProjectIds: number[]) => {
    const projects = await getCurseForgeProjects(curseProjectIds);
    return curseProjectIds.map(id => {
      return projects.find(project => project.id === id);
    });
  });

  async getCurseForgeProjectUrl(curseProjectId: number): Promise<string> {
    return (await this.#getCurseForgeProjectDataLoader.load(curseProjectId)).websiteUrl;
  }
}

export { ModService };
