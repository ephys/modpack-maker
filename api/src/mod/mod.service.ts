import { Injectable } from '@nestjs/common';
import { ModJar } from './mod-jar.entity';
import { ModVersion } from './mod-version.entity';
import * as DataLoader from 'dataloader';
import { getCurseForgeProjects, TCurseProject } from '../curseforge.api';

@Injectable()
class ModService {

  getModsInJar(jar: ModJar): Promise<ModVersion[]> {
    return jar.$get('mods');
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
    console.log(projects);
    return curseProjectIds.map(id => {
      return projects.find(project => project.id === id);
    });
  });

  async getCurseForgeProjectUrl(curseProjectId: number): Promise<string> {
    return (await this.#getCurseForgeProjectDataLoader.load(curseProjectId)).websiteUrl;
  }
}

export { ModService };
