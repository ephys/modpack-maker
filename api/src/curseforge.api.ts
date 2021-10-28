import type { RequestInit } from 'node-fetch';
import fetch from 'node-fetch';
import { uriTag } from '../../client/src/utils/url-utils';
import { ReleaseType } from './mod/mod-jar.entity';

// https://twitchappapi.docs.apiary.io/#/reference/0/

type TSearchModsParams = {
  pageSize: number,
  page: number,
  categoryId?: number,
};

const MINECRAFT_GAME_ID = 432;
const MINECRAFT_MODS_SECTION_ID = 6;

export async function *iterateCurseForgeModList(params: Omit<TSearchModsParams, 'page'>): AsyncGenerator<TCurseProject> {
  let page = 0;
  let results;

  do {
    // eslint-disable-next-line no-await-in-loop
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

export async function searchCurseForgeModList(params: TSearchModsParams): Promise<TCurseProject[]> {

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

  const uri = `/addon/search?${search.toString()}`;

  return fetchCurseForge(uri);
}

export type TCurseforgeCategory = {
  id: number,
  name: string,
  url: string,
  avatarUrl: string,
  parentId: number,
  rootId: number,
  projectId: number,
  avatarId: number,
  gameId: number,
  slug: string,
  dateModified: string,
};

export async function getCurseForgeModCategories(): Promise<TCurseforgeCategory[]> {
  return fetchCurseForge('/category/section/6');
}

export type TCurseProjectAttachement = {
  id: number,
  projectId: number,
  description: string,
  isDefault: boolean, // project icon
  title: string,
  url: string,
  status: number,
};

export type TCurseProject = {
  id: number,
  name: string,
  // authors
  attachments: TCurseProjectAttachement[],
  websiteUrl: string,
  sourceUrl: string,
  wikiUrl: string,
  summary: string,
  defaultFileId: number,
  downloadCount: number,
  latestFiles: TCurseFile[],
  categories: TCurseforgeCategory[],
  status: number,
  primaryCategoryId: number,
  // categorySection
  slug: string,
// gameVersionLatestFiles
// isFeatured
//  popularityScore
//  gamePopularityRank
//  primaryLanguage
//  gameSlug
 modLoaders: Array<'Forge' | 'Fabric' | 'Rift'>,
  gameName: string,
  portalName: string,
  dateModified: string,
  dateCreated: string,
  dateReleased: string,
  isAvailable: boolean,
  isExperimental: boolean,
};

export type TCurseFile = {
  id: number,
  displayName: string,
  fileName: string,
  fileDate: string,
  fileLength: number,
  releaseType: number,
  fileStatus: number,
  downloadUrl: string,
  isAlternate: boolean,
  alternateFileId: number,
  dependencies: [], // TODO
  isAvailable: boolean,
  modules: Array<{
    foldername: string,
    fingerprint: number,
  }>,
  packageFingerprint: number,
  gameVersion: string[], // "Forge", "1.16.4"
  // installMetadata:
  // serverPackFileId
  // hasInstallScript
  // gameVersionDateReleased
  // gameVersionFlavor
};

export async function getCurseForgeModFiles(curseProjectId: number | string): Promise<TCurseFile[]> {
  return fetchCurseForge(`/addon/${curseProjectId}/files`);
}

export async function getCurseForgeProjects(ids: number[]): Promise<TCurseProject[]> {
  return fetchCurseForge(`/addon`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ids),
  });
}

async function fetchCurseForge<T>(path, options?: RequestInit, text?: boolean): Promise<T> {
  const res = await fetch(`https://addons-ecs.forgesvc.net/api/v2${path}`, options);

  if (!res.ok) {
    throw new Error(`Could not fetch curseforge ${path}: ${res.status} - ${res.statusText} ${await res.text()}`);
  }

  if (text) {
    return res.text() as unknown as T;
  }

  return res.json() as unknown as T;
}

export async function fetchCurseProjectDescription(sourceId: string | number) {
  return fetchCurseForge(uriTag`/addon/${sourceId}/description`, undefined, true);
}

export function getCurseReleaseType(releaseTypeId: number): ReleaseType {
  switch (releaseTypeId) {
    case 1: return ReleaseType.STABLE;
    case 2: return ReleaseType.BETA;
    case 3: return ReleaseType.ALPHA;
    default: throw new Error(`Unknown Curse release type ID ${releaseTypeId}`);
  }
}
