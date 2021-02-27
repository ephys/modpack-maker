import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CurseforgeProject } from './curseforge-project.entity';
import { ModJar } from './mod-jar.entity';
import { FETCH_CURSE_FILES_QUEUE } from './mod.constants';
import { Op, Sequelize } from 'sequelize';

const curseForgeProjectUrl = /^https?:\/\/www.curseforge.com\/minecraft\/mc-mods\/([^\/]+)(\/.+)?$/;

@Injectable()
class ModDiscoveryService {
  constructor(@InjectQueue(FETCH_CURSE_FILES_QUEUE) private modDiscoveryQueue: Queue) {}

  async retryFailedFiles() {
    const projects = await CurseforgeProject.findAll({
      where: Sequelize.where(
        Sequelize.fn('array_length', Sequelize.col('failedFileIds'), 1),
        { [Op.gt]: 0 },
      ),
    });

    const failedProjectsIds = projects.map(project => project.forgeId);

    await CurseforgeProject.update({
      failedFileIds: [],
      versionListUpToDate: false,
    }, {
      where: {
        forgeId: { [Op.in]: failedProjectsIds },
      },
    });

    return this.updateCurseProjectFiles(failedProjectsIds);
  }

  async updateCurseProjectFiles(projectId: number | number[]) {
    if (Array.isArray(projectId)) {
      await this.modDiscoveryQueue.addBulk(projectId.map(id => ({ data: id })));
    } else {
      await this.modDiscoveryQueue.add(projectId);
    }
  }

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
