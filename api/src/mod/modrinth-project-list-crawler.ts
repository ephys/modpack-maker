import { InjectQueue } from '@nestjs/bull';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bull';
import { Sequelize } from 'sequelize-typescript';
import { SEQUELIZE_PROVIDER } from '../database/database.providers';
import { iterateModrinthModList } from '../modrinth.api';
import type { TProjectCreationAttributes } from '../project/project.entity';
import { Project, ProjectSource } from '../project/project.entity';
import { refreshStaleJarLists, upsertUpdatedProjects } from './curseforge-project-list-crawler';
import { FETCH_MODRINTH_JARS_QUEUE } from './mod.constants';

const PAGE_SIZE = 100;

@Injectable()
export class ModrinthProjectListCrawler {
  private readonly logger = new Logger(ModrinthProjectListCrawler.name);

  constructor(
    @Inject(SEQUELIZE_PROVIDER) private readonly sequelize: Sequelize,
    @InjectQueue(FETCH_MODRINTH_JARS_QUEUE) private readonly fetchModrinthJarsQueue: Queue,
  ) {
    void this.handleCron();
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    const lastUpdateStr: string = await Project.max('lastSourceEditAt', {
      where: {
        sourceType: ProjectSource.MODRINTH,
      },
    });

    this.logger.log('Updating Modrinth Project List');

    const lastUpdateAt = new Date(lastUpdateStr);

    // using a map in case two pages return the same item
    const modrinthProjects = new Map<string, TProjectCreationAttributes>();

    for await (const sourceProject of iterateModrinthModList({ pageSize: PAGE_SIZE })) {
      const modLastModified = new Date(sourceProject.date_modified);

      // reached last mod we fetched
      if (modLastModified.getTime() < lastUpdateAt.getTime()) {
        break;
      }

      const id = unprefix(sourceProject.mod_id, 'local-');

      modrinthProjects.set(id, {
        sourceType: ProjectSource.MODRINTH,
        sourceId: id,
        sourceSlug: sourceProject.slug,
        lastSourceEditAt: modLastModified,
        versionListUpToDate: false,
        description: sourceProject.description,
        name: sourceProject.title,
        iconUrl: sourceProject.icon_url,
      });
    }

    this.logger.log(`Found a total of ${modrinthProjects.size} item(s) to update`);

    await upsertUpdatedProjects(
      Array.from(modrinthProjects.values()),
      this.sequelize,
      ProjectSource.MODRINTH,
    );

    await refreshStaleJarLists(ProjectSource.MODRINTH, this.fetchModrinthJarsQueue, this.sequelize, this.logger);
  }
}

function unprefix(text: string, prefix: string): string {
  if (!text.startsWith(prefix)) {
    return text;
  }

  return text.substr(prefix.length);
}
