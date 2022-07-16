import assert from 'node:assert';
import type { RequestInit } from 'node-fetch';
import fetch from 'node-fetch';
import retryAsPromised from 'retry-as-promised';
import { uriTag } from '../../common/url-utils';
import { ReleaseType } from './mod/mod-jar.entity';

// https://docs.curseforge.com

type TSearchModsParams = {
  pageSize: number,
  page: number,
  categoryId?: number,
  gameVersion?: string,
};

const MINECRAFT_GAME_ID = 432;
const MINECRAFT_MODS_SECTION_ID = 6;

export async function *iterateCurseForgeModList(params: Omit<TSearchModsParams, 'page'>): AsyncGenerator<TCurseProject> {
  let page = 0;
  let results: TPagedResponse<TCurseProject>;

  do {
    // eslint-disable-next-line no-await-in-loop
    results = await searchCurseForgeModList({
      ...params,
      page,
    });

    for (const result of results.data) {
      yield result;
    }

    page += 1;
  } while (results.data.length === params.pageSize);
}

type TPagedResponse<Data> = {
  data: Data[],
  pagination: {
    index: 5,
    pageSize: 1,
    resultCount: 1,
    totalCount: 88294,
  },
};

export async function searchCurseForgeModList(params: TSearchModsParams): Promise<TPagedResponse<TCurseProject>> {

  const search = new URLSearchParams({
    gameId: String(MINECRAFT_GAME_ID),
    index: String(params.page * params.pageSize),
    pageSize: String(params.pageSize),
    sectionId: String(MINECRAFT_MODS_SECTION_ID),
    // sort 3 is LastUpdated
    sortField: '3',
    sortOrder: 'desc',
  });

  if (params.categoryId) {
    search.set('categoryId', String(params.categoryId));
  }

  if (params.gameVersion) {
    search.set('gameVersion', String(params.gameVersion));
  }

  const uri = `/v1/mods/search?${search.toString()}`;

  return fetchCurseForge(uri);
}

export type TCurseforgeCategory = {
  id: number,
  gameId: number,
  name: string,
  slug: string,
  url: string,
  iconUrl: string,
  dateModified: string,
  /**
   * Whether this has sub categories
   */
  isClass?: boolean,
  classId?: number,
  parentCategoryId?: number,
};

export async function getCurseForgeModCategories(): Promise<TCurseforgeCategory[]> {
  const out: { data: TCurseforgeCategory[] } = await fetchCurseForge(`/v1/categories?gameId=${MINECRAFT_GAME_ID}&classId=${MINECRAFT_MODS_SECTION_ID}`);

  return out.data;
}

export type TCurseImage = {
  id: number,
  modId: number,
  title: string,
  description: string,
  thumbnailUrl: string,
  url: string,
};

export type TCurseProject = {
  id: number,
  gameId: number,
  name: string,
  slug: string,
  links: {
    websiteUrl: string,
    wikiUrl: string,
    issuesUrl: string | null,
    sourceUrl: string | null,
  },
  summary: string,
  status: number,
  downloadCount: number,
  isFeatured: boolean,
  primaryCategoryId: number,
  categories: TCurseforgeCategory[],
  classId: number,
  // authors
  logo: TCurseImage,
  screenshots: TCurseImage[],
  mainFileId: number,
  latestFiles: TCurseFile[],
  latestFilesIndexes: [], // TODO
  dateModified: string,
  dateCreated: string,
  dateReleased: string,
  allowModDistribution: boolean,
  gamePopularityRank: number,
  isAvailable: number,
  thumbsUpCount: number,
};

export type TCurseFile = {
  id: number,
  gameId: number,
  modId: number,
  isAvailable: boolean,
  displayName: string,
  fileName: string,
  releaseType: number,
  fileStatus: number,
  'hashes': Array<{
    'value': string,
    'algo': number,
  }>,
  fileDate: string,
  fileLength: number,
  downloadCount: number,
  downloadUrl: string | null,
  gameVersions: string[], // "Forge", "1.16.4"
  sortableGameVersions: Array<{
    gameVersionName: string,
    gameVersionPadded: string,
    gameVersion: string,
    gameVersionReleaseDate: string,
    gameVersionTypeId: number,
  }>,
  dependencies: [], // TODO
  alternateFileId: number,
  isServerPack: boolean,
  fileFingerprint: number,
  modules: [], // TODO
};

export async function *iterateCurseForgeModFileList(modId: number | string, params: Omit<TSearchModsParams, 'page'>): AsyncGenerator<TCurseFile> {
  let page = 0;
  let results: TPagedResponse<TCurseFile>;

  do {
    // eslint-disable-next-line no-await-in-loop
    results = await getCurseForgeModFiles(modId, {
      ...params,
      page,
    });

    for (const result of results.data) {
      yield result;
    }

    page += 1;
  } while (results.data.length === params.pageSize);
}

type TGetModFilesParams = {
  pageSize: number,
  page: number,
};

export async function getCurseForgeModFiles(
  curseProjectId: number | string,
  params: TGetModFilesParams,
): Promise<TPagedResponse<TCurseFile>> {
  const search = new URLSearchParams({
    index: String(params.page * params.pageSize),
    pageSize: String(params.pageSize),
  });

  const uri = uriTag`/v1/mods/${curseProjectId}/files`;

  return fetchCurseForge(`${uri}?${search.toString()}`);
}

assert(process.env.CURSEFORGE_API_KEY != null, 'please provide CURSEFORGE_API_KEY in api/.env file');

async function fetchCurseForge<T>(path, options?: RequestInit, text?: boolean): Promise<T> {
  const res = await retryAsPromised(async () => {
    const res1 = await fetch(`https://api.curseforge.com${path}`, {
      ...options,
      headers: {
        ...options?.headers,
        Accept: 'application/json',
        'x-api-key': process.env.CURSEFORGE_API_KEY!,
      },
    });

    if (!res1.ok) {
      console.error(path, res1.status);
      throw new Error(`Could not fetch curseforge ${path}: ${res1.status} - ${res1.statusText} ${await res1.text()}`);
    }

    return res1;
  }, {
    match: [
      /Gateway Time-out/,
    ],
    max: 200,
  });

  if (text) {
    return res.text() as unknown as T;
  }

  return res.json() as unknown as T;
}

export async function fetchCurseProjectDescription(sourceId: string | number) {
  const res = await fetchCurseForge<{ data: string }>(uriTag`/v1/mods/${sourceId}/description`, undefined, false);

  return res.data;
}

export function getCurseReleaseType(releaseTypeId: number): ReleaseType {
  switch (releaseTypeId) {
    case 1:
      return ReleaseType.STABLE;
    case 2:
      return ReleaseType.BETA;
    case 3:
      return ReleaseType.ALPHA;
    default:
      throw new Error(`Unknown Curse release type ID ${releaseTypeId}`);
  }
}
