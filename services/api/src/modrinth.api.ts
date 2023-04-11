import type { RequestInit } from 'node-fetch';
import fetch from 'node-fetch';
import { ReleaseType } from './mod/mod-jar.entity.js';

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
  mod_id: string,
  slug: string,
  author: string,
  title: string,
  description: string,
  categories: ModrinthCategory[],
  versions: string[], // minecraft versions
  downloads: number,
  follows: number,
  page_url: string,
  icon_url: string,
  author_url: string,
  date_created: string,
  date_modified: string,
  latest_version: string, // minecraft version
  license: string, // mit, custom
  client_side: 'optional' | 'required' | 'unsupported',
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
  mod_id: string,
  author_id: string,
  featured: boolean,
  name: string,
  version_number: string,
  changelog: string,
  changelog_url: string | null,
  date_published: string,
  downloads: number,
  version_type: 'alpha' | 'beta' | 'release',
  files: TModrinthProjectVersionFile[],
  // dependencies: [],
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
  return fetchModrinthApi(`/mod/${encodeURIComponent(modrinthProjectId)}/version`, {
    headers: {
      'User-Agent': 'User-Agent: ephys/modpack-maker/dev (zoe@ephys.dev)',
    },
  });
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
