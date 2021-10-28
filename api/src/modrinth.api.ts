import type { RequestInit } from 'node-fetch';
import fetch from 'node-fetch';
import { ReleaseType } from './mod/mod-jar.entity';

// https://github.com/modrinth/labrinth/wiki/API-Documentation

type TSearchModsParams = {
  pageSize: number,
  page: number,
};

export enum ModrinthCategory {
  utility = 'utility',
  storage = 'storage',
  misc = 'misc',
  fabric = 'fabric',
}

export type TModrinthProject = {
  // eslint-disable-next-line camelcase
  mod_id: string,
  slug: string,
  author: string,
  title: string,
  description: string,
  categories: ModrinthCategory[],
  versions: string[], // minecraft versions
  downloads: number,
  follows: number,
  // eslint-disable-next-line camelcase
  page_url: string,
  // eslint-disable-next-line camelcase
  icon_url: string,
  // eslint-disable-next-line camelcase
  author_url: string,
  // eslint-disable-next-line camelcase
  date_created: string,
  // eslint-disable-next-line camelcase
  date_modified: string,
  // eslint-disable-next-line camelcase
  latest_version: string, // minecraft version
  license: string, // mit, custom
  // eslint-disable-next-line camelcase
  client_side: 'optional' | 'required' | 'unsupported',
  // eslint-disable-next-line camelcase
  server_side: 'optional' | 'required' | 'unsupported',
};

export async function *iterateModrinthModList(params: Omit<TSearchModsParams, 'page'>): AsyncGenerator<TModrinthProject> {
  let page = 0;
  let hits: TModrinthProject[];

  do {
    // eslint-disable-next-line no-await-in-loop
    const res = await getModrinthModListPage({
      ...params,
      page,
    });

    hits = res.hits;

    for (const result of hits) {
      yield result;
    }

    page += 1;
  } while (hits.length === params.pageSize);
}

type TModrinthPage<T> = {
  hits: T[],
  offset: number,
  limit: number,
  // eslint-disable-next-line camelcase
  total_hits: number,
};

export async function getModrinthModListPage(params: TSearchModsParams): Promise<TModrinthPage<TModrinthProject>> {

  const search = new URLSearchParams({
    // sort order
    index: 'updated',
    limit: String(params.pageSize),
    offset: String(params.page * params.pageSize),
  });

  const uri = `/mod?${search.toString()}`;

  return fetchModrinthApi(uri);
}

export type TModrinthProjectVersion = {
  id: string,
  // eslint-disable-next-line camelcase
  mod_id: string,
  // eslint-disable-next-line camelcase
  author_id: string,
  featured: boolean,
  name: string,
  // eslint-disable-next-line camelcase
  version_number: string,
  changelog: string,
  // eslint-disable-next-line camelcase
  changelog_url: string | null,
  // eslint-disable-next-line camelcase
  date_published: string,
  downloads: number,
  // eslint-disable-next-line camelcase
  version_type: 'alpha' | 'beta' | 'release',
  files: TModrinthProjectVersionFile[],
  // dependencies: [],
  // eslint-disable-next-line camelcase
  game_versions: string[], // minecraft versions
  loaders: Array<'fabric' | 'forge'>,
};

export type TModrinthProjectVersionFile = {
  hashes: {
    sha1: string,
    sha512: string,
  },
  url: string,
  filename: string,
  primary: boolean,
};

export async function getModrinthModFiles(modrinthProjectId: string): Promise<TModrinthProjectVersion[]> {
  return fetchModrinthApi(`/mod/${encodeURIComponent(modrinthProjectId)}/version`);
}

async function fetchModrinthApi<T>(path, options?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.modrinth.com/api/v1${path}`, options);

  if (!res.ok) {
    throw new Error(`Could not fetch modrinth ${path}: ${res.status} - ${res.statusText} ${await res.text()}`);
  }

  return res.json() as unknown as T;
}

export function getModrinthReleaseType(releaseTypeId: TModrinthProjectVersion['version_type']): ReleaseType {
  switch (releaseTypeId) {
    case 'release': return ReleaseType.STABLE;
    case 'beta': return ReleaseType.BETA;
    case 'alpha': return ReleaseType.ALPHA;
    default: throw new Error(`Unknown Modrinth version_type ${releaseTypeId}`);
  }
}

export async function getModrinthProjectDescription(sourceId: string): Promise<string> {
  // eslint-disable-next-line camelcase
  const response = await fetchModrinthApi<TModrinthProject & { body: string, body_url: string }>(`/mod/${encodeURIComponent(sourceId)}`);
  if (response.body) {
    return response.body;
  }

  if (response.body_url) {
    const res = await fetch(response.body_url);

    return res.text();
  }

  return '';
}
