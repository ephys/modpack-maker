import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CurseforgeProject } from './curseforge-project.entity';
import { ModVersion } from './mod-version.entity';

const curseForgeProjectUrl = /^https?:\/\/www.curseforge.com\/minecraft\/mc-mods\/([^\/]+)(\/.+)?$/

@Injectable()
class ModDiscoveryService {
  constructor(@InjectQueue('fetch-curse-project-files') private modDiscoveryQueue: Queue) {}

  async discoverUrls(urls: string[]): Promise<{ curseProjectIds: number[], modIds: string[], unknownUrls: string[] }> {
    const unknownUrls = [];

    const unprocessedForgeIds = new Set<number>();
    const processedModIds = new Set<string>();
    for (const url of urls) {
      const slug = url.match(curseForgeProjectUrl)?.[1];
      // this is not a valid curseforge project
      if (!slug) {
        unknownUrls.push(url);
        continue;
      }

      // TODO: parallel
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
      // TODO: use DISTINCT (modId, curseProjectId) so we don't load the same line many times
      const existingMods = await ModVersion.findAll({
        attributes: ['modId'],
        where: {
          curseProjectId: project.forgeId,
        },
      });

      if (existingMods.length > 0) {
        for (const mod of existingMods) {
          processedModIds.add(mod.modId);
        }
      } else {
        const forgeId = project.forgeId;
        unprocessedForgeIds.add(forgeId);
      }
    }

    await this.modDiscoveryQueue.addBulk(Array.from(unprocessedForgeIds).map(id => ({ data: id })));

    return {
      unknownUrls,
      curseProjectIds: Array.from(unprocessedForgeIds),
      modIds: Array.from(processedModIds),
    };
  }
}

export { ModDiscoveryService }
