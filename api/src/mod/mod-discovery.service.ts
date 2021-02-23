import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CurseforgeProject } from './curseforge-project.entity';

const curseForgeProjectUrl = /^https?:\/\/www.curseforge.com\/minecraft\/mc-mods\/([^\/]+)(\/.+)?$/

@Injectable()
class ModDiscoveryService {
  constructor(@InjectQueue('fetch-curse-project-files') private modDiscoveryQueue: Queue) {}

  async discoverUrls(urls: string[]) {
    const forgeIds = new Set();
    for (const url of urls) {
      const slug = url.match(curseForgeProjectUrl)?.[1];
      if (!slug) {
        // TODO: return error to front-end
        console.error('Could not extract slug from url ' + url);
        continue;
      }

      const project = await CurseforgeProject.findOne({
        where: { slug },
      });

      if (project == null) {
        // TODO: return error to front-end
        console.error('Unknown curseforge project ' + slug);
        continue;
      }

      const forgeId = project.forgeId;
      forgeIds.add(forgeId);
    }

    await this.modDiscoveryQueue.addBulk(Array.from(forgeIds).map(id => ({ data: id })));
  }
}

export { ModDiscoveryService }
