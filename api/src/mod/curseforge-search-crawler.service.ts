import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CurseforgeProject } from './curseforge-project.entity';
import { getCurseForgeModCategories, iterateForgeModList } from '../curseforge.api';
import { SEQUELIZE_PROVIDER } from '../database/database.providers';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import { lastItem } from '../utils/generic-utils';

const PAGE_SIZE = 200;

@Injectable()
export class CurseforgeSearchCrawlerService {
  private readonly logger = new Logger(CurseforgeSearchCrawlerService.name);

  constructor(@Inject(SEQUELIZE_PROVIDER) private readonly sequelize: Sequelize) {
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
          }),
          Promise.all(
            updatableItems.map(item => {
              return CurseforgeProject.update(item, {
                where: { forgeId: item.forgeId },
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
      // this is a subcategory (category 6 = minecraft-mods)
      if (category.parentGameCategoryId !== 6) {
        continue;
      }

      this.logger.log(`fetching category ${category.name}`);

      let itemCount = 0;

      for await (const item of iterateForgeModList({ pageSize: PAGE_SIZE, categoryId: category.id })) {
        allItems.set(item.id, {
          forgeId: item.id,
          slug: item.slug,
          lastForgeEditAt: getLastEditDate(item),
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
}

function getLastEditDate(curseProject): string {
  const mostRecentFile = lastItem(curseProject.latestFiles);
  // FIXME Typings
  // @ts-ignore
  return mostRecentFile.fileDate;
}
