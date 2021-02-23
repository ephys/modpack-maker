import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import fetch from 'node-fetch';
import { CurseforgeProject } from './curseforge-project.entity';

const PAGE_SIZE = 200;

@Injectable()
export class CurseforgeSearchCrawlerService {
  private readonly logger = new Logger(CurseforgeSearchCrawlerService.name);

  constructor() {
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
    for await (const item of iterateForgeModList({ pageSize: PAGE_SIZE })) {
      const itemLastUpdate = new Date(item.dateModified);

      // we only go up to the first item whose update is already stored
      if (itemLastUpdate.getTime() <= lastUpdateAt.getTime()) {
        break;
      }

      items.set(item.id, {
        forgeId: item.id,
        slug: item.slug,
        lastForgeEditAt: item.dateModified,
      });
    }

    this.logger.log(`Updated a total of ${items.size} item(s)`);

    if (items.size > 0) {
      await CurseforgeProject.bulkCreate(Array.from(items.values()), {
        fields: ['forgeId', 'slug', 'lastForgeEditAt'],
        updateOnDuplicate: ['slug', 'lastForgeEditAt'],
      });
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

      for await (const item of iterateForgeModList({pageSize: PAGE_SIZE, categoryId: category.id })) {
        allItems.set(item.id, {
          forgeId: item.id,
          slug: item.slug,
          lastForgeEditAt: item.dateModified,
        });

        itemCount++;
      }

      this.logger.log(`Found a total of ${itemCount} mods in category ${category.name}`);
      this.logger.log('---')
    }

    this.logger.log(`Retrieved a total of ${allItems.size} mods from curseforge`);

    await CurseforgeProject.bulkCreate(Array.from(allItems.values()), {
      fields: ['forgeId', 'slug', 'lastForgeEditAt'],
      updateOnDuplicate: ['slug', 'lastForgeEditAt'],
    });
  }
}

type TSearchModsParams = {
  pageSize: number,
  page: number,
  categoryId?: number,
};

const MINECRAFT_GAME_ID = 432;
const MINECRAFT_MODS_SECTION_ID = 6;

async function* iterateForgeModList(params: Omit<TSearchModsParams, 'page'>) {
  let page = 0;
  let results;

  do {
    results = await searchCurseForgeModList({
      ...params,
      page,
    });

    for (const result of results) {
      yield result;
    }

    page += 1;
  } while (results.length === params.pageSize);
}

async function searchCurseForgeModList(params: TSearchModsParams) {

  const search = new URLSearchParams({
    gameId: String(MINECRAFT_GAME_ID),
    index: String(params.page * params.pageSize),
    pageSize: String(params.pageSize),
    sectionId: String(MINECRAFT_MODS_SECTION_ID),
    // sort 2 is date modified DESC
    sort: '2',
  });

  if (params.categoryId) {
    search.set('categoryID', String(params.categoryId));
  }

  const uri = `https://addons-ecs.forgesvc.net/api/v2/addon/search?` + search.toString();
  const res = await fetch(uri);

  if (!res.ok) {
    throw new Error('Could not fetch curseforge mod list ( ' + uri + ' )');
  }

  return res.json();
}

async function getCurseForgeModCategories() {
  const res = await fetch('https://addons-ecs.forgesvc.net/api/v2/category/section/6');

  if (!res.ok) {
    throw new Error('Could not fetch curseforge mod categories');
  }

  return res.json();
}
