import { InjectQueue } from '@nestjs/bull';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Sequelize } from '@sequelize/core';
import { Queue } from 'bull';
import { SEQUELIZE_PROVIDER } from '../database/database.providers.js';
import { iterateModrinthModList } from '../modrinth.api.js';
import type { TProjectCreationAttributes } from '../project/project.entity.js';
import { Project, ProjectSource } from '../project/project.entity.js';
import { refreshStaleJarLists, upsertUpdatedProjects } from './curseforge-project-list-crawler.js';
import { FETCH_MODRINTH_JARS_QUEUE } from './mod.constants.js';

const PAGE_SIZE = 100;

@Injectable()
export class ModrinthProjectListCrawler {
  private readonly logger = new Logger(ModrinthProjectListCrawler.name);
  #refreshing = false;
  #shouldDoCompleteCrawl = false;

  constructor(
    @Inject(SEQUELIZE_PROVIDER) private readonly sequelize: Sequelize,
    @InjectQueue(FETCH_MODRINTH_JARS_QUEUE) private readonly fetchModrinthJarsQueue: Queue,
  ) {
    void this.requestRefresh();
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    try {
      await this.requestRefresh();
    } catch (error) {
      this.logger.error(new Error('Periodic CurseForge refresh failed', { cause: error }));
    }
  }

  async requestRefresh(opts?: { complete?: boolean }): Promise<void> {
    if (opts?.complete) {
      this.#shouldDoCompleteCrawl = true;
    }

    if (this.#refreshing) {
      this.logger.warn('Skipping refresh request because another one is already running');

      return;
    }

    try {
      this.#refreshing = true;

      await this.#executeRefresh();
      this.#shouldDoCompleteCrawl = false;
    } finally {
      this.#refreshing = false;
    }
  }

  async #executeRefresh(): Promise<void> {
    if (process.env.DISABLE_MODRINTH === '1') {
      return;
    }

    try {
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
        if (!this.#shouldDoCompleteCrawl && modLastModified.getTime() < lastUpdateAt.getTime()) {
          break;
        }

        const id = unprefix(sourceProject.project_id, 'local-');

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
        [...modrinthProjects.values()],
        this.sequelize,
        ProjectSource.MODRINTH,
      );

      await refreshStaleJarLists(ProjectSource.MODRINTH, this.fetchModrinthJarsQueue, this.sequelize, this.logger);
    } catch (error) {
      console.error('Refreshing modrinth project list failed');
      console.error(error);
    }
  }
}

function unprefix(text: string, prefix: string): string {
  if (!text.startsWith(prefix)) {
    return text;
  }

  return text.slice(prefix.length);
}
