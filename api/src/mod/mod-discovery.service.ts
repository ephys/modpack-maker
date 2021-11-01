import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import Sequelize from 'sequelize';
import { Op } from '../esm-compat/sequelize-esm';
import type { ProjectSource } from '../project/project.entity';
import { Project } from '../project/project.entity';
import { FETCH_CURSE_JARS_QUEUE } from './mod.constants';

@Injectable()
class ModDiscoveryService {
  private readonly logger = new Logger(ModDiscoveryService.name);

  constructor(@InjectQueue(FETCH_CURSE_JARS_QUEUE) private readonly fetchJarQueue: Queue) {}

  async retryFailedFiles(filter: string) {
    filter = filter.toLowerCase().trim();

    const projects = (await Project.findAll({
      where: Sequelize.literal(`"failedFiles"::text <> '{}'`),
    })).filter(project => {
      for (const error of Object.values(project.failedFiles)) {
        if (error.toLowerCase().includes(filter)) {
          return true;
        }
      }

      return false;
    });

    this.logger.log(`Retrying errored files of ${projects.length} projects`);

    await Project.update({
      failedFiles: {},
      versionListUpToDate: false,
    }, {
      where: {
        internalId: { [Op.in]: projects.map(project => project.internalId) },
      },
    });

    return this.updateCurseProjectFiles(projects.map(project => {
      return [project.sourceType, project.sourceId];
    }));
  }

  async updateCurseProjectFiles(projectIds: Array<[sourceType: ProjectSource, sourceId: string]>) {
    await this.fetchJarQueue.addBulk(projectIds.map(id => ({ data: id })));
  }
}

export { ModDiscoveryService };
