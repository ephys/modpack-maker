import { minecraftVersions } from '@ephys/modpack-maker-common';
import { InjectQueue } from '@nestjs/bull';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Op, QueryTypes, Sequelize, and, or } from '@sequelize/core';
import { Queue } from 'bull';
import type { TCurseFile } from '../curseforge.api.js';
import { getCurseForgeModCategories, iterateCurseForgeModList } from '../curseforge.api.js';
import { SEQUELIZE_PROVIDER } from '../database/database.providers.js';
import type { TProjectCreationAttributes } from '../project/project.entity.js';
import { Project, ProjectSource } from '../project/project.entity.js';
import { FETCH_CURSE_JARS_QUEUE } from './mod.constants.js';

const PAGE_SIZE = 50;

export type TFetchJarQueueData = [sourceType: ProjectSource, sourceId: string];

export async function refreshStaleJarLists(
  sourceType: ProjectSource,
  queue: Queue<TFetchJarQueueData>,
  sequelize: Sequelize,
  logger: Logger,
) {
  const itemsInUpdateQueue = await queue.count();

  // we'll try again next CRON
  if (itemsInUpdateQueue > 0) {
    return;
  }

  logger.log(`Refreshing ${sourceType} projects marked as stale`);

  // select all projects whose file list is potentially outdated
  // language=PostgreSQL
  const projects = await sequelize.query<{ sourceId: string, sourceType: ProjectSource }>(`
      SELECT DISTINCT p."sourceType", p."sourceId" FROM "Projects" p
      WHERE NOT p."versionListUpToDate" AND p."sourceType" = :sourceType
    `, {
    type: QueryTypes.SELECT,
    replacements: {
      sourceType,
    },
  });

  await queue.addBulk(projects.map(project => {
    return { data: [project.sourceType /* forge */, project.sourceId/* project 1234 */] };
  }));
}

@Injectable()
export class CurseforgeProjectListCrawler {
  private readonly logger = new Logger(CurseforgeProjectListCrawler.name);
  #refreshing = false;
  #shouldDoCompleteCrawl = false;

  constructor(
    @Inject(SEQUELIZE_PROVIDER) private readonly sequelize: Sequelize,
    @InjectQueue(FETCH_CURSE_JARS_QUEUE) private readonly fetchCurseJarsQueue: Queue<TFetchJarQueueData>,
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
    if (process.env.DISABLE_CURSEFORGE === '1') {
      return;
    }

    const lastUpdateStr: string = await Project.max('lastSourceEditAt', {
      where: {
        sourceType: ProjectSource.CURSEFORGE,
      },
    });

    if (!lastUpdateStr || this.#shouldDoCompleteCrawl) {
      await this.doInitialCurseFetch();

      return;
    }

    this.logger.log('Updating CurseForge Project List');

    const lastUpdateAt = new Date(lastUpdateStr);

    // using a map in case two pages return the same item
    const items = new Map<number, TProjectCreationAttributes>();

    // items from API are sorted by LAST EDIT DESC
    // LAST EDIT means "last time a file was uploaded to this project"
    // Also, API takes some time before including the latest items in its API response
    for await (const item of iterateCurseForgeModList({ pageSize: PAGE_SIZE })) {
      const itemLastUpdate = getLastEditDate(item);

      if (itemLastUpdate == null) {
        continue;
      }

      // we only go up to the first item whose update is already stored
      if (new Date(itemLastUpdate).getTime() <= lastUpdateAt.getTime()) {
        break;
      }

      items.set(item.id, {
        sourceType: ProjectSource.CURSEFORGE,
        sourceId: String(item.id),
        sourceSlug: item.slug,
        lastSourceEditAt: new Date(itemLastUpdate),
        versionListUpToDate: false,
        name: item.name,
        iconUrl: item.logo?.url ?? '',
        description: item.summary,
      });
    }

    this.logger.log(`Found a total of ${items.size} item(s) to update`);

    await upsertUpdatedProjects(
      [...items.values()],
      this.sequelize,
      ProjectSource.CURSEFORGE,
    );

    await refreshStaleJarLists(ProjectSource.CURSEFORGE, this.fetchCurseJarsQueue, this.sequelize, this.logger);
  }

  private async doInitialCurseFetch() {
    this.logger.log('Executing complete CurseForge project list crawl (as opposed to incremental update)');

    // during first fetch, we get every page
    // in subsequent fetches, we only go as far as the highest dateModified we stored in DB

    // forge API will not return anything past the 10.000th item of the current query
    // as an unstable workaround, we split our fetches by categories as, currently, they contain less than 10k items
    // each.
    // Alternative option was to fetch by game version.
    const categories = await getCurseForgeModCategories();
    // These categories include more than 10k items, so we'll filter by game version too.
    const categoriesToSplit = new Set([434]);
    const allItems = new Map<number, TProjectCreationAttributes>();

    for (const category of categories) {
      const mcVersionFilters = categoriesToSplit.has(category.id) ? minecraftVersions : ['*'];
      for (const gameVersion of mcVersionFilters) {
        this.logger.log(`fetching category ${category.name} (id ${category.id} - ${category.url}) for mc ${gameVersion}`);

        let itemCount = 0;

        // eslint-disable-next-line no-await-in-loop
        for await (const item of iterateCurseForgeModList({
          pageSize: PAGE_SIZE,
          categoryId: category.id,
          gameVersion: gameVersion === '*' ? undefined : gameVersion,
        })) {
          const lastUpload = getLastEditDate(item);

          if (lastUpload == null) {
            continue;
          }

          allItems.set(item.id, {
            sourceType: ProjectSource.CURSEFORGE,
            sourceId: String(item.id),
            sourceSlug: item.slug,
            lastSourceEditAt: new Date(lastUpload),
            versionListUpToDate: false,
            name: item.name,
            iconUrl: item.logo?.url ?? '',
            description: item.summary,
          });

          itemCount++;
        }

        this.logger.log(`Found a total of ${itemCount} mods in category ${category.name} for mc ${gameVersion}`);
        this.logger.log('---');
      }
    }

    this.logger.log(`Retrieved a total of ${allItems.size} mods from curseforge`);

    await upsertUpdatedProjects(
      [...allItems.values()],
      this.sequelize,
      ProjectSource.CURSEFORGE,
    );

    await refreshStaleJarLists(ProjectSource.CURSEFORGE, this.fetchCurseJarsQueue, this.sequelize, this.logger);
  }
}

function getLastEditDate(curseProject): string | null {
  const mostRecentFile: TCurseFile | undefined = curseProject.latestFiles.at(-1);

  return mostRecentFile?.fileDate ?? null;
}

export async function upsertUpdatedProjects(
  itemsArray: TProjectCreationAttributes[],
  sequelize: Sequelize,
  projectSource: ProjectSource,
) {
  if (itemsArray.length === 0) {
    return;
  }

  await sequelize.transaction(async transaction => {
    const existingProjects = await Project.findAll({
      attributes: ['sourceId', 'sourceSlug', 'sourceType'],
      where: and(
        { sourceType: projectSource },
        or({
          sourceId: { [Op.in]: itemsArray.map(item => item.sourceId) },
        }, {
          sourceSlug: { [Op.in]: itemsArray.map(item => item.sourceSlug) },
        }),
      ),
      transaction,
    });

    const newItems: TProjectCreationAttributes[] = [];
    const updatableItems: TProjectCreationAttributes[] = [];
    const conflictingSlugs: string[] = [];

    const existingProjectIds = new Set(existingProjects.map(project => project.sourceId));
    const slugToExistingProject = new Map<string, Project>();
    for (const project of existingProjects) {
      if (project.sourceSlug == null) {
        continue;
      }

      slugToExistingProject.set(project.sourceSlug, project);
    }

    for (const fetchedProject of itemsArray) {
      const existingProjectBySlug = slugToExistingProject.get(fetchedProject.sourceSlug);
      if (existingProjectBySlug?.sourceSlug != null && existingProjectBySlug.sourceId !== fetchedProject.sourceId) {
        conflictingSlugs.push(existingProjectBySlug.sourceSlug);
      }

      if (existingProjectIds.has(fetchedProject.sourceId)) {
        updatableItems.push(fetchedProject);
      } else {
        newItems.push(fetchedProject);
      }
    }

    await Project.update({ sourceSlug: null }, {
      transaction,
      where: {
        sourceSlug: { [Op.in]: conflictingSlugs },
        sourceType: projectSource,
      },
    });

    await Promise.all([
      Project.bulkCreate(
        newItems,
        {
          fields: ['sourceId', 'sourceSlug', 'sourceType',
            'lastSourceEditAt', 'versionListUpToDate',
            'name', 'description', 'iconUrl'],
          transaction,
        },
      ),
      Promise.all(updatableItems.map(async item => {
        return Project.update(item, {
          where: {
            sourceId: item.sourceId,
            sourceType: projectSource,
          },
          transaction,
        });
      })),
    ]);
  });
}
