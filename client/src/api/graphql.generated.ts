import { gql } from 'urql';
import * as Urql from './urql';

export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string,
  String: string,
  Boolean: boolean,
  Int: number,
  Float: number,
};

export type TCreateModpackInput = {
  minecraftVersion: Scalars['String'],
  modLoader: ModLoader,
  name: Scalars['String'],
};

export type TCreateModpackPayload = {
  __typename: 'CreateModpackPayload',
  node?: Maybe<TModpack>,
};

export enum DependencyType {
  Breaks = 'breaks',
  Conflicts = 'conflicts',
  Depends = 'depends',
  Recommends = 'recommends',
  Suggests = 'suggests',
}

export type TGqlModDependency = {
  __typename: 'GqlModDependency',
  modId: Scalars['String'],
  type: DependencyType,
  versionRange?: Maybe<Scalars['String']>,
};

export type TModJar = {
  __typename: 'ModJar',
  curseForgePage: Scalars['String'],
  downloadUrl: Scalars['String'],
  fileName: Scalars['String'],
  id: Scalars['ID'],
  mods: TModVersion[],
  releaseType: ReleaseType,
};

export type TModJarModsArgs = {
  matchingModpack?: Maybe<Scalars['ID']>,
};

export type TModJarEdge = {
  __typename: 'ModJarEdge',
  cursor: Scalars['String'],
  node: TModJar,
};

export enum ModLoader {
  Fabric = 'FABRIC',
  Forge = 'FORGE',
}

export type TModVersion = {
  __typename: 'ModVersion',
  dependencies: TGqlModDependency[],
  modId: Scalars['String'],
  modVersion: Scalars['String'],
  name: Scalars['String'],
  supportedMinecraftVersions: Array<Scalars['String']>,
  supportedModLoader: ModLoader,
  updatedVersion?: Maybe<TModJar>,
};

export type TModVersionUpdatedVersionArgs = {
  matchingModpack: Scalars['ID'],
};

export type TModpack = {
  __typename: 'Modpack',
  id: Scalars['ID'],
  lastVersion: TModpackVersion,
  lastVersionIndex: Scalars['Int'],
  minecraftVersion: Scalars['String'],
  modLoader: ModLoader,
  name: Scalars['String'],
  version?: Maybe<TModpackVersion>,
};

export type TModpackVersionArgs = {
  index: Scalars['Int'],
};

export type TModpackMod = {
  __typename: 'ModpackMod',
  addedAt: Scalars['String'],
  isLibraryDependency: Scalars['Boolean'],
  jar: TModJar,
};

export type TModpackVersion = {
  __typename: 'ModpackVersion',
  downloadUrl: Scalars['String'],
  id: Scalars['ID'],
  installedJars: TModpackMod[],
  name: Scalars['String'],
};

export type TMutation = {
  __typename: 'Mutation',
  createModpack: TCreateModpackPayload,
  removeJarFromModpack: TRemoveJarFromModpackPayload,
  replaceModpackJar: TReplaceModpackJarPayload,
  setModpackJarIsLibrary: TSetModpackJarIsLibraryPayload,
};

export type TMutationCreateModpackArgs = {
  input: TCreateModpackInput,
};

export type TMutationRemoveJarFromModpackArgs = {
  input: TRemoveJarFromModpackInput,
};

export type TMutationReplaceModpackJarArgs = {
  input: TReplaceModpackJarInput,
};

export type TMutationSetModpackJarIsLibraryArgs = {
  input: TSetModpackJarIsLibraryInput,
};

export type TPageInfo = {
  __typename: 'PageInfo',
  endCursor?: Maybe<Scalars['String']>,
  hasNextPage: Scalars['Boolean'],
  hasPreviousPage: Scalars['Boolean'],
  startCursor?: Maybe<Scalars['String']>,
};

export type TProject = {
  __typename: 'Project',
  description: Scalars['String'],
  homepage: Scalars['String'],
  iconUrl: Scalars['String'],
  jars: TModJar[],
  name: Scalars['String'],
  source: ProjectSource,
};

export type TProjectConnection = {
  __typename: 'ProjectConnection',
  edges?: Maybe<TProjectEdge[]>,
  nodes?: Maybe<TProject[]>,
  pageInfo: TPageInfo,
  totalCount: Scalars['Int'],
};

export type TProjectEdge = {
  __typename: 'ProjectEdge',
  cursor: Scalars['String'],
  node: TProject,
};

export enum ProjectSearchSortOrder {
  FirstFileUpload = 'FirstFileUpload',
  LastFileUpload = 'LastFileUpload',
  ProjectName = 'ProjectName',
}

export enum ProjectSearchSortOrderDirection {
  Asc = 'ASC',
  Desc = 'DESC',
}

export enum ProjectSource {
  Curseforge = 'CURSEFORGE',
  Modrinth = 'MODRINTH',
}

export type TQuery = {
  __typename: 'Query',
  modpack?: Maybe<TModpack>,
  modpacks: TModpack[],
  /**
   * *Returns project matching the search query.*
   * Uses [lucene syntax](https://lucene.apache.org/core/2_9_4/queryparsersyntax.html)
   *
   * ### Supported fields (mods):
   *
   * Mods fields combinations `(modLoader AND minecraftVersion)` are checked per-mod instead of per-project.
   * this means that if a Project has two jars, one that supports modLoader and one that supports minecraftVersion, but not
   * both at the same time, it will not be returned. A single jar needs to support both to be returned.
   *
   * - **modId** - returns only projects that have at least one jar containing this modId.
   * - **modName** - returns only projects that have at least one jar containing one mod that matches modName.
   * - **minecraftVersion** - returns only projects that have at least one jar containing one mod that supports minecraftVersion.
   * - **modLoader** - returns only projects that have at least one jar containing one mod that uses this modLoader.
   *
   * ### Supported fields (projects):
   * Project fields combinations are checked per-projects.
   *
   * - **projectName** - returns only projects that have at least one jar containing one mod that matches projectName.
   * - **tags** - returns only projects that have this tag listed.
   * - **source** - returns only projects that have been fetched from a specific source. Supported values: `modrinth` or `curseforge`.
   *
   * ---
   *
   * If no field is provided (Example 2), it'll be interpreted as a wildcard search on the projectName field.
   *
   * Example 1: `modId:magic-feather name:"Magic Feather" modLoader:FORGE minecraftVersion:(1.16.4 OR 1.16.5)`
   * Example 2: `Magic Feather` (interpreted as `projectName:"*Magic Feather*"`).
   *
   * ---
   *
   * The sort-order is query-aware. Meaning that if the query specifies a `minecraftVersion` or a `modLoader` field:
   *
   * - With FirstFileUpload, the date used for the sort order will be the date on the oldest file matching the query was uploaded.
   *    This can be used for eg. "sort by the date on which the projects first supported this minecraft version".
   * - With LastFileUpload, the used for the sort order will be the date on the most recent file matching the query was uploaded.
   *    This can be used for eg. "sort by the date on which the projects last published an update compatible with this minecraft version".
   */
  projects: TProjectConnection,
};

export type TQueryModpackArgs = {
  id: Scalars['ID'],
};

export type TQueryProjectsArgs = {
  after?: Maybe<Scalars['String']>,
  before?: Maybe<Scalars['String']>,
  first?: Maybe<Scalars['Int']>,
  last?: Maybe<Scalars['Int']>,
  order?: Maybe<ProjectSearchSortOrder>,
  orderDir?: Maybe<ProjectSearchSortOrderDirection>,
  query?: Maybe<Scalars['String']>,
};

export enum ReleaseType {
  Alpha = 'ALPHA',
  Beta = 'BETA',
  Stable = 'STABLE',
}

export type TRemoveJarFromModpackError = {
  __typename: 'RemoveJarFromModpackError',
  code: RemoveJarFromModpackErrorCodes,
  message: Scalars['String'],
};

export enum RemoveJarFromModpackErrorCodes {
  JarNotFound = 'JAR_NOT_FOUND',
  ModpackNotFound = 'MODPACK_NOT_FOUND',
}

export type TRemoveJarFromModpackInput = {
  jar: Scalars['ID'],
  modpackVersion: Scalars['ID'],
};

export type TRemoveJarFromModpackPayload = {
  __typename: 'RemoveJarFromModpackPayload',
  error?: Maybe<TRemoveJarFromModpackError>,
  node?: Maybe<TModpackVersion>,
};

export type TReplaceModpackJarError = {
  __typename: 'ReplaceModpackJarError',
  code: ReplaceModpackJarErrorCodes,
  message: Scalars['String'],
};

export enum ReplaceModpackJarErrorCodes {
  JarNotFound = 'JAR_NOT_FOUND',
  ModpackNotFound = 'MODPACK_NOT_FOUND',
  NewJarNotFound = 'NEW_JAR_NOT_FOUND',
}

export type TReplaceModpackJarInput = {
  modpackVersion: Scalars['ID'],
  newJar: Scalars['ID'],
  oldJar: Scalars['ID'],
};

export type TReplaceModpackJarPayload = {
  __typename: 'ReplaceModpackJarPayload',
  error?: Maybe<TReplaceModpackJarError>,
  node?: Maybe<TModpackVersion>,
};

export type TSetModpackJarIsLibraryError = {
  __typename: 'SetModpackJarIsLibraryError',
  code: SetModpackJarIsLibraryErrorCodes,
  message: Scalars['String'],
};

export enum SetModpackJarIsLibraryErrorCodes {
  JarNotFound = 'JAR_NOT_FOUND',
  JarNotInModpack = 'JAR_NOT_IN_MODPACK',
  ModpackNotFound = 'MODPACK_NOT_FOUND',
}

export type TSetModpackJarIsLibraryInput = {
  isLibrary: Scalars['Boolean'],
  jar: Scalars['ID'],
  modpackVersion: Scalars['ID'],
};

export type TSetModpackJarIsLibraryPayload = {
  __typename: 'SetModpackJarIsLibraryPayload',
  error?: Maybe<TSetModpackJarIsLibraryError>,
  node?: Maybe<TModpackMod>,
};

export type TCreateModpackMutationVariables = Exact<{
  input: TCreateModpackInput,
}>;

export type TCreateModpackMutation = { __typename: 'Mutation', createModpack: { __typename: 'CreateModpackPayload', node?: { __typename: 'Modpack', id: string, lastVersionIndex: number } | null | undefined } };

export type TRemoveJarFromModpackMutationVariables = Exact<{
  input: TRemoveJarFromModpackInput,
}>;

export type TRemoveJarFromModpackMutation = { __typename: 'Mutation', removeJarFromModpack: { __typename: 'RemoveJarFromModpackPayload', node?: { __typename: 'ModpackVersion', id: string } | null | undefined, error?: { __typename: 'RemoveJarFromModpackError', code: RemoveJarFromModpackErrorCodes } | null | undefined } };

export type TReplaceModpackJarMutationVariables = Exact<{
  input: TReplaceModpackJarInput,
}>;

export type TReplaceModpackJarMutation = { __typename: 'Mutation', replaceModpackJar: { __typename: 'ReplaceModpackJarPayload', node?: { __typename: 'ModpackVersion', id: string } | null | undefined, error?: { __typename: 'ReplaceModpackJarError', code: ReplaceModpackJarErrorCodes } | null | undefined } };

export type TSetModpackJarIsLibraryMutationVariables = Exact<{
  input: TSetModpackJarIsLibraryInput,
}>;

export type TSetModpackJarIsLibraryMutation = { __typename: 'Mutation', setModpackJarIsLibrary: { __typename: 'SetModpackJarIsLibraryPayload', node?: { __typename: 'ModpackMod', isLibraryDependency: boolean } | null | undefined, error?: { __typename: 'SetModpackJarIsLibraryError', code: SetModpackJarIsLibraryErrorCodes } | null | undefined } };

export type TModpackViewQueryVariables = Exact<{
  modpackId: Scalars['ID'],
  versionIndex: Scalars['Int'],
}>;

export type TModpackViewQuery = { __typename: 'Query', modpack?: { __typename: 'Modpack', id: string, minecraftVersion: string, modLoader: ModLoader, name: string, version?: { __typename: 'ModpackVersion', id: string, downloadUrl: string, name: string, installedJars: Array<{ __typename: 'ModpackMod', addedAt: string, isLibraryDependency: boolean, jar: { __typename: 'ModJar', id: string, downloadUrl: string, fileName: string, releaseType: ReleaseType, curseForgePage: string, mods: Array<{ __typename: 'ModVersion', modId: string, modVersion: string, name: string, supportedMinecraftVersions: string[], supportedModLoader: ModLoader, updatedVersion?: { __typename: 'ModJar', fileName: string, id: string, releaseType: ReleaseType } | null | undefined, dependencies: Array<{ __typename: 'GqlModDependency', modId: string, versionRange?: string | null | undefined, type: DependencyType }> }> } }> } | null | undefined } | null | undefined };

export type TModpackListViewQueryVariables = Exact<{ [key: string]: never }>;

export type TModpackListViewQuery = { __typename: 'Query', modpacks: Array<{ __typename: 'Modpack', id: string, minecraftVersion: string, modLoader: ModLoader, name: string, lastVersionIndex: number }> };

export const CreateModpackDocument = /* #__PURE__ */ gql`
    mutation createModpack($input: CreateModpackInput!) {
  createModpack(input: $input) {
    node {
      id
      lastVersionIndex
    }
  }
}
    `;

export function useCreateModpackMutation() {
  return Urql.useMutation<TCreateModpackMutation, TCreateModpackMutationVariables>(CreateModpackDocument);
}

export const RemoveJarFromModpackDocument = /* #__PURE__ */ gql`
    mutation removeJarFromModpack($input: RemoveJarFromModpackInput!) {
  removeJarFromModpack(input: $input) {
    node {
      id
    }
    error {
      code
    }
  }
}
    `;

export function useRemoveJarFromModpackMutation() {
  return Urql.useMutation<TRemoveJarFromModpackMutation, TRemoveJarFromModpackMutationVariables>(RemoveJarFromModpackDocument);
}

export const ReplaceModpackJarDocument = /* #__PURE__ */ gql`
    mutation replaceModpackJar($input: ReplaceModpackJarInput!) {
  replaceModpackJar(input: $input) {
    node {
      id
    }
    error {
      code
    }
  }
}
    `;

export function useReplaceModpackJarMutation() {
  return Urql.useMutation<TReplaceModpackJarMutation, TReplaceModpackJarMutationVariables>(ReplaceModpackJarDocument);
}

export const SetModpackJarIsLibraryDocument = /* #__PURE__ */ gql`
    mutation setModpackJarIsLibrary($input: SetModpackJarIsLibraryInput!) {
  setModpackJarIsLibrary(input: $input) {
    node {
      isLibraryDependency
    }
    error {
      code
    }
  }
}
    `;

export function useSetModpackJarIsLibraryMutation() {
  return Urql.useMutation<TSetModpackJarIsLibraryMutation, TSetModpackJarIsLibraryMutationVariables>(SetModpackJarIsLibraryDocument);
}

export const ModpackViewDocument = /* #__PURE__ */ gql`
    query ModpackView($modpackId: ID!, $versionIndex: Int!) {
  modpack(id: $modpackId) {
    id
    minecraftVersion
    modLoader
    name
    version(index: $versionIndex) {
      id
      downloadUrl
      name
      installedJars {
        addedAt
        isLibraryDependency
        jar {
          id
          downloadUrl
          fileName
          releaseType
          curseForgePage
          mods(matchingModpack: $modpackId) {
            modId
            modVersion
            name
            supportedMinecraftVersions
            supportedModLoader
            updatedVersion(matchingModpack: $modpackId) {
              fileName
              id
              releaseType
            }
            dependencies {
              modId
              versionRange
              type
            }
          }
        }
      }
    }
  }
}
    `;

export function useModpackViewQuery(options: Omit<Urql.UseQueryArgs<TModpackViewQueryVariables>, 'query'> = {}) {
  return Urql.useQuery<TModpackViewQuery>({ query: ModpackViewDocument, ...options });
}

export const ModpackListViewDocument = /* #__PURE__ */ gql`
    query ModpackListView {
  modpacks {
    id
    minecraftVersion
    modLoader
    name
    lastVersionIndex
  }
}
    `;

export function useModpackListViewQuery(options: Omit<Urql.UseQueryArgs<TModpackListViewQueryVariables>, 'query'> = {}) {
  return Urql.useQuery<TModpackListViewQuery>({ query: ModpackListViewDocument, ...options });
}
