import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import Sequelize from 'sequelize';
import { Op } from '../esm-compat/sequelize-esm';
import type { ProjectSource } from '../project/project.entity';
import { Project } from '../project/project.entity';
import { FETCH_CURSE_JARS_QUEUE } from './mod.constants';

@Injectable()
class ModDiscoveryService {
  constructor(@InjectQueue(FETCH_CURSE_JARS_QUEUE) private readonly fetchJarQueue: Queue) {}

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
    await this.fetchJarQueue.addBulk(projectIds.map(id => ({ data: id })));
  }
}

export { ModDiscoveryService };
