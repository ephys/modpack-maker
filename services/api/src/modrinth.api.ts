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

export interface ModrinthDonationPage {
  id: string;
  platform: string;
  url: string;
}

export interface ModrinthProjectSearchResult {
  author: string;
  categories: ModrinthCategory[];
  client_side: ModrinthRequirementType;
  color: number;
  date_created: string;
  date_modified: string;
  description: string;
  display_categories: ModrinthCategory[];
  downloads: number;
  featured_gallery: string;
  follows: number;
  gallery: string[];
  icon_url: string;
  latest_version: string;
  license: string;
  project_id: string;
  project_type: 'mod' | 'modpack';
  server_side: ModrinthRequirementType;
  slug: string;
  title: string;
  versions: string[];
}

export type ModrinthRequirementType = 'optional' | 'required' | 'unsupported';

export interface ModrinthProject {
  approved: string;
  author_url: string;
  /** long description */
  body: string;
  body_url: string;
  categories: ModrinthCategory[];
  client_side: 'optional' | 'required' | 'unsupported';
  color: string;
  date_created: string; // minecraft versions
  date_modified: string;
  /** short description */
  description: string;
  discord_url: string;
  donation_urls: ModrinthDonationPage[];
  downloads: number;
  follows: number;
  gallery: Array<{
    url: string,
    featured: boolean,
    title: string,
    description: string,
    created: string,
    ordering: number,
  }>;
  game_versions: string[];
  icon_url: string;
  issues_url: string;
  latest_version: string;
  license: {
    id: string,
    name: string,
    url: string,
  };
  loaders: string[]; // minecraft version
  moderator_message: string | null; // mit, custom
  page_url: string;
  project_id: string;
  project_type: 'mod' | 'modpack';
  published: string;
  server_side: 'optional' | 'required' | 'unsupported';
  slug: string;
  source_url: string;
  status: string;
  team: string;
  title: string;
  updated: string;
  versions: string[];
  wiki_url: string;
}

export async function *iterateModrinthModList(params: Omit<TSearchModsParams, 'page'>): AsyncGenerator<ModrinthProject> {
  let page = 0;
  let hits: ModrinthProject[];

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

export async function getModrinthModListPage(params: TSearchModsParams): Promise<TModrinthPage<ModrinthProject>> {

  const search = new URLSearchParams({
    // sort order
    index: 'updated',
    limit: String(params.pageSize),
    offset: String(params.page * params.pageSize),
    project_type: 'mod',
  });

  const uri = `/search?${search.toString()}`;

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
  return fetchModrinthApi(`/project/${encodeURIComponent(modrinthProjectId)}/version`, {
    headers: {
      'User-Agent': 'User-Agent: ephys/modpack-maker/dev (zoe@ephys.dev)',
    },
  });
}

async function fetchModrinthApi<T>(path, options?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.modrinth.com/v2${path}`, options);

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

  const response = await fetchModrinthApi<ModrinthProject & { body: string, body_url: string }>(`/project/${encodeURIComponent(sourceId)}`);
  if (response.body) {
    return response.body;
  }

  if (response.body_url) {
    const res = await fetch(response.body_url);

    return res.text();
  }

  return '';
}
