import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CurseforgeProject } from './curseforge-project.entity';
import { getCurseForgeModCategories, iterateForgeModList } from '../curseforge.api';
import { SEQUELIZE_PROVIDER } from '../database/database.providers';
import { Sequelize } from 'sequelize-typescript';
import { Op, QueryTypes } from 'sequelize';
import { lastItem } from '../utils/generic-utils';
import { InjectQueue } from '@nestjs/bull';
import { FETCH_CURSE_FILES_QUEUE } from './mod.constants';
import { Queue } from 'bull';

const PAGE_SIZE = 200;

@Injectable()
export class CurseforgeSearchCrawlerService {
  private readonly logger = new Logger(CurseforgeSearchCrawlerService.name);

  constructor(
    @Inject(SEQUELIZE_PROVIDER) private readonly sequelize: Sequelize,
    @InjectQueue(FETCH_CURSE_FILES_QUEUE) private modDiscoveryQueue: Queue,
  ) {
    this.handleCron();
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    const lastUpdateStr: string = await CurseforgeProject.max('lastForgeEditAt');
    if (!lastUpdateStr) {
      return this.doInitialCurseFetch();
    }

    this.logger.log('Updating Forge Database');

    const lastUpdateAt = new Date(lastUpdateStr);

    const items = new Map();

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
        forgeId: item.id,
        slug: item.slug,
        lastForgeEditAt: itemLastUpdate,
        versionListUpToDate: false,
      });
    }

    this.logger.log(`Found a total of ${items.size} item(s) to update`);

    if (items.size > 0) {
      const itemsArray = Array.from(items.values());

      await this.sequelize.transaction(async transaction => {
        const existingProjects = await CurseforgeProject.findAll({
          attributes: ['forgeId'],
          where: {
            forgeId: { [Op.in]: itemsArray.map(item => item.forgeId) },
          },
          transaction,
        });

        const newItems = [];
        const updatableItems = [];

        const existingProjectIds = new Set(existingProjects.map(project => project.forgeId));
        for (const fetchedProject of itemsArray) {
          if (existingProjectIds.has(fetchedProject.forgeId)) {
            updatableItems.push(fetchedProject);
          } else {
            newItems.push(fetchedProject);
          }
        }

        await Promise.all([
          CurseforgeProject.bulkCreate(newItems, {
            fields: ['forgeId', 'slug', 'lastForgeEditAt', 'versionListUpToDate'],
            transaction,
          }),
          Promise.all(
            updatableItems.map(item => {
              return CurseforgeProject.update(item, {
                where: { forgeId: item.forgeId },
                transaction,
              });
            }),
          ),
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

    await CurseforgeProject.bulkCreate(Array.from(allItems.values()), {
      fields: ['forgeId', 'slug', 'lastForgeEditAt', 'versionListUpToDate'],
      updateOnDuplicate: ['slug', 'lastForgeEditAt', 'versionListUpToDate'],
    });
  }

  private async checkModsHaveUpdates() {
    const itemsInUpdateQueue = await this.modDiscoveryQueue.count()

    // we'll try again next CRON
    if (itemsInUpdateQueue > 0) {
      return;
    }

    this.logger.log('Checking if Curse Projects that are used in modpacks have updates');

    // select all curseProjectId that are used in modpacks
    //  and that have changes detected by handleCron, but not yet processed
    const projects = await this.sequelize.query<{ curseProjectId: number }>(`
      SELECT DISTINCT j."curseProjectId" FROM "ModJars" j
        INNER JOIN "ModpackMods" mm on j."internalId" = mm."jarId"
      WHERE "curseProjectId" IN (SELECT cfp."forgeId" FROM "CurseforgeProjects" cfp WHERE cfp."versionListUpToDate" = FALSE)
    `, {
      type: QueryTypes.SELECT,
    });

    console.log(projects);

    await this.modDiscoveryQueue.addBulk(projects.map(project => {
      return { data: project.curseProjectId };
    }));
  }
}

function getLastEditDate(curseProject): string | null {
  const mostRecentFile = lastItem(curseProject.latestFiles);
  // FIXME Typings
  // @ts-ignore
  return mostRecentFile?.fileDate;
}
