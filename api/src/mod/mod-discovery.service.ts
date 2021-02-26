import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CurseforgeProject } from './curseforge-project.entity';
import { ModVersion } from './mod-version.entity';
import { ModJar } from './mod-jar.entity';

const curseForgeProjectUrl = /^https?:\/\/www.curseforge.com\/minecraft\/mc-mods\/([^\/]+)(\/.+)?$/;

@Injectable()
class ModDiscoveryService {
  constructor(@InjectQueue('fetch-curse-project-files') private modDiscoveryQueue: Queue) {}

  async discoverUrls(urls: string[]): Promise<{
    pendingCurseProjectIds: number[],
    availableCurseProjectIds: number[],
    unknownUrls: string[],
  }> {
    const unknownUrls = [];

    const unprocessedCurseIds = new Set<number>();
    const processedCurseIds = new Set<number>();
    for (const url of urls) {
      const slug = url.match(curseForgeProjectUrl)?.[1];
      // this is not a valid curseforge project
      if (!slug) {
        unknownUrls.push(url);
        continue;
      }

      // TODO: use DataLoader
      const project = await CurseforgeProject.findOne({
        where: { slug },
      });

      // this project has not been found by CurseforgeSearchCrawlerService
      if (project == null) {
        unknownUrls.push(url);
        continue;
      }

      // TODO: use DataLoader
      const existingJar = await ModJar.findOne({
        attributes: ['curseProjectId'],
        where: {
          curseProjectId: project.forgeId,
        },
      });

      if (existingJar) {
        processedCurseIds.add(existingJar.curseProjectId);
      } else {
        const forgeId = project.forgeId;
        unprocessedCurseIds.add(forgeId);
      }
    }

    await this.modDiscoveryQueue.addBulk(Array.from(unprocessedCurseIds).map(id => ({ data: id })));

    return {
      unknownUrls,
      pendingCurseProjectIds: Array.from(unprocessedCurseIds),
      availableCurseProjectIds: Array.from(processedCurseIds),
    };
  }
}

export { ModDiscoveryService };
