import { InjectQueue } from '@nestjs/bull';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bull';
import { Op, QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { getCurseForgeModCategories, iterateForgeModList } from '../curseforge.api';
import { SEQUELIZE_PROVIDER } from '../database/database.providers';
import { lastItem } from '../utils/generic-utils';
import { FETCH_CURSE_FILES_QUEUE } from './mod.constants';
import { Project, ProjectSource } from './project.entity';

const PAGE_SIZE = 50;

@Injectable()
export class ProjectListUpdater {
  private readonly logger = new Logger(ProjectListUpdater.name);

  constructor(
    @Inject(SEQUELIZE_PROVIDER) private readonly sequelize: Sequelize,
    @InjectQueue(FETCH_CURSE_FILES_QUEUE) private readonly modDiscoveryQueue: Queue,
  ) {
    void this.handleCron();
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    const lastUpdateStr: string = await Project.max('lastSourceEditAt', {
      where: {
        sourceType: ProjectSource.CURSEFORGE,
      },
    });

    if (!lastUpdateStr) {
      await this.doInitialCurseFetch();

      return;
    }

    this.logger.log('Updating Forge Database');

    const lastUpdateAt = new Date(lastUpdateStr);

    type Item = {
      sourceId: string,
      sourceSlug: string,
      lastSourceEditAt: Date,
      versionListUpToDate: boolean,
    };

    const items = new Map<number, Item>();

    // items from API are sorted by LAST EDIT DESC
    // LAST EDIT means "last time a file was uploaded to this project"
    // Also, API takes some time before including the latest items in its API response
    for await (const item of iterateForgeModList({ pageSize: PAGE_SIZE })) {
      const itemLastUpdate = getLastEditDate(item);

      if (itemLastUpdate == null) {
        continue;
      }

      // we only go up to the first item whose update is already stored
      if (new Date(itemLastUpdate).getTime() <= lastUpdateAt.getTime()) {
        break;
      }

      items.set(item.id, {
        sourceId: String(item.id),
        sourceSlug: item.slug,
        lastSourceEditAt: new Date(itemLastUpdate),
        versionListUpToDate: false,
      });
    }

    this.logger.log(`Found a total of ${items.size} item(s) to update`);

    if (items.size > 0) {
      const itemsArray = Array.from(items.values());

      await this.sequelize.transaction(async transaction => {
        const existingProjects = await Project.findAll({
          attributes: ['sourceId', 'sourceSlug', 'sourceType'],
          where: Sequelize.and(
            { sourceType: ProjectSource.CURSEFORGE },
            // @ts-expect-error
            Sequelize.or({
              sourceId: { [Op.in]: itemsArray.map(item => item.sourceId) },
            }, {
              sourceSlug: { [Op.in]: itemsArray.map(item => item.sourceSlug) },
            }),
          ),
          transaction,
        });

        const newItems: Item[] = [];
        const updatableItems: Item[] = [];
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
            sourceType: ProjectSource.CURSEFORGE,
          },
        });

        await Promise.all([
          Project.bulkCreate(
            newItems.map(item => {
              return {
                ...item,
                sourceType: ProjectSource.CURSEFORGE,
              };
            }),
            {
              fields: ['sourceId', 'sourceSlug', 'sourceType', 'lastSourceEditAt', 'versionListUpToDate'],
              transaction,
            },
          ),
          Promise.all(updatableItems.map(async item => {
            return Project.update(item, {
              where: {
                sourceId: item.sourceId,
                sourceType: ProjectSource.CURSEFORGE,
              },
              transaction,
            });
          })),
        ]);
      });

      // we used to just do bulkCreate with onConflict update but
      //  sequelize does not use the right conflict key in its bulkCreate
      // https://github.com/sequelize/sequelize/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc
      // await CurseforgeProject.bulkCreate(Array.from(items.values()), {
      //   fields: ['forgeId', 'slug', 'lastForgeEditAt', 'versionListUpToDate'],
      //   updateOnDuplicate: ['forgeId', 'slug', 'lastForgeEditAt', 'versionListUpToDate'],
      // });
    }

    await this.checkModsHaveUpdates();
  }

  private async doInitialCurseFetch() {
    this.logger.log('Doing first curseforge crawl');

    // during first fetch, we get every page
    // in subsequent fetches, we only go as far as the highest dateModified we stored in DB

    // forge API will not return anything past the 10.000th item of the current query
    // as an unstable workaround, we split our fetches by categories as, currently, they contain less than 10k items
    // each.
    // Alternative option was to fetch by game version.
    const categories = await getCurseForgeModCategories();
    const allItems = new Map();

    for (const category of categories) {
      this.logger.log(`fetching category ${category.name}`);

      let itemCount = 0;

      // eslint-disable-next-line no-await-in-loop
      for await (const item of iterateForgeModList({ pageSize: PAGE_SIZE, categoryId: category.id })) {
        const lastUpload = getLastEditDate(item);

        if (lastUpload == null) {
          continue;
        }

        allItems.set(item.id, {
          forgeId: item.id,
          slug: item.slug,
          lastForgeEditAt: lastUpload,
          versionListUpToDate: false,
        });

        itemCount++;
      }

      this.logger.log(`Found a total of ${itemCount} mods in category ${category.name}`);
      this.logger.log('---');
    }

    this.logger.log(`Retrieved a total of ${allItems.size} mods from curseforge`);

    await Project.bulkCreate(Array.from(allItems.values()), {
      fields: ['sourceId', 'sourceSlug', 'lastSourceEditAt', 'versionListUpToDate'],
      updateOnDuplicate: ['sourceSlug', 'lastSourceEditAt', 'versionListUpToDate'],
    });
  }

  private async checkModsHaveUpdates() {
    const itemsInUpdateQueue = await this.modDiscoveryQueue.count();

    // we'll try again next CRON
    if (itemsInUpdateQueue > 0) {
      return;
    }

    this.logger.log('Checking if Curse Projects that are used in modpacks have updates');

    // !TODO: crawl everything

    // select all sourceId that are used in modpacks
    //  and that have changes detected by handleCron, but not yet processed
    // language=PostgreSQL
    const projects = await this.sequelize.query<{ sourceId: string, sourceType: ProjectSource }>(`
      SELECT DISTINCT p."sourceType", p."sourceId" FROM "Projects" p
        INNER JOIN "ModJars" mj ON p."internalId" = mj."projectId"
        INNER JOIN "ModpackMods" mm on mj."internalId" = mm."jarId"
    `, {
      type: QueryTypes.SELECT,
    });

    await this.modDiscoveryQueue.addBulk(projects.map(project => {
      return { data: [project.sourceType /* forge */, project.sourceId/* project 1234 */] };
    }));
  }
}

function getLastEditDate(curseProject): string | null {
  const mostRecentFile = lastItem(curseProject.latestFiles);

  // FIXME Typings
  // @ts-expect-error
  return mostRecentFile?.fileDate;
}
