import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bull';
import { Op, Sequelize } from 'sequelize';
import { ModJar } from './mod-jar.entity';
import { FETCH_CURSE_FILES_QUEUE } from './mod.constants';
import { Project } from './project.entity';

const curseForgeProjectUrl = /^https?:\/\/www.curseforge.com\/minecraft\/mc-mods\/([^/]+)(\/.+)?$/;

@Injectable()
class ModDiscoveryService {
  constructor(@InjectQueue(FETCH_CURSE_FILES_QUEUE) private readonly modDiscoveryQueue: Queue) {}

  async retryFailedFiles() {
    const projects = await Project.findAll({
      where: Sequelize.where(
        Sequelize.fn('array_length', Sequelize.col('failedFileIds'), 1),
        { [Op.gt]: 0 },
      ),
    });

    const failedProjectsIds = projects.map(project => Number(project.sourceId));

    await Project.update({
      failedFileIds: [],
      versionListUpToDate: false,
    }, {
      where: {
        sourceId: { [Op.in]: failedProjectsIds },
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
    const unknownUrls: string[] = [];

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
      // eslint-disable-next-line no-await-in-loop
      const project = await Project.findOne({
        where: { sourceSlug: slug },
      });

      // this project has not been found by CurseforgeSearchCrawlerService
      if (project == null) {
        unknownUrls.push(url);
        continue;
      }

      // TODO: use DataLoader
      // check if we already have jars for this project
      // eslint-disable-next-line no-await-in-loop
      const existingJar = await ModJar.findOne({
        attributes: ['projectId'],
        where: {
          projectId: project.internalId,
        },
      });

      if (existingJar) {
        processedCurseIds.add(existingJar.projectId);
      } else {
        unprocessedCurseIds.add(project.internalId);
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
