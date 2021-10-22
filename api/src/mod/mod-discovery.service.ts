import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { Op, Sequelize } from 'sequelize';
import { ModJar } from './mod-jar.entity';
import { FETCH_CURSE_JARS_QUEUE } from './mod.constants';
import type { ProjectSource } from './project.entity';
import { Project } from './project.entity';

const curseForgeProjectUrl = /^https?:\/\/www.curseforge.com\/minecraft\/mc-mods\/([^/]+)(\/.+)?$/;

@Injectable()
class ModDiscoveryService {
  constructor(@InjectQueue(FETCH_CURSE_JARS_QUEUE) private readonly modDiscoveryQueue: Queue) {}

  async retryFailedFiles() {
    const projects = await Project.findAll({
      where: Sequelize.literal(`"failedFiles"::text <> '{}'`),
    });

    await Project.update({
      failedFiles: {},
      versionListUpToDate: false,
    }, {
      where: {
        sourceId: { [Op.in]: projects.map(project => project.internalId) },
      },
    });

    return this.updateCurseProjectFiles(projects.map(project => {
      return [project.sourceType, project.sourceId];
    }));
  }

  async updateCurseProjectFiles(projectIds: Array<[sourceType: ProjectSource, sourceId: string]>) {
    await this.modDiscoveryQueue.addBulk(projectIds.map(id => ({ data: id })));
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
