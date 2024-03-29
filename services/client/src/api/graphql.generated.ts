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

export type TAddJarToModpackError = {
  __typename: 'AddJarToModpackError',
  code: AddJarToModpackErrorCodes,
  message: Scalars['String'],
};

export enum AddJarToModpackErrorCodes {
  JarNotFound = 'JAR_NOT_FOUND',
  ModpackNotFound = 'MODPACK_NOT_FOUND',
}

export type TAddJarToModpackInput = {
  jar: Scalars['ID'],
  modpackVersion: Scalars['ID'],
};

export type TAddJarToModpackPayload = {
  __typename: 'AddJarToModpackPayload',
  error?: Maybe<TAddJarToModpackError>,
  node?: Maybe<TModpackVersion>,
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

export type TCreateNewModpackVersionError = {
  __typename: 'CreateNewModpackVersionError',
  code: CreateNewModpackVersionErrorCodes,
  message: Scalars['String'],
};

export enum CreateNewModpackVersionErrorCodes {
  ModpackNotFound = 'MODPACK_NOT_FOUND',
}

export type TCreateNewModpackVersionInput = {
  fromModpackVersion: Scalars['ID'],
  name: Scalars['String'],
};

export type TCreateNewModpackVersionPayload = {
  __typename: 'CreateNewModpackVersionPayload',
  error?: Maybe<TCreateNewModpackVersionError>,
  node?: Maybe<TModpackVersion>,
};

export enum DependencyType {
  Breaks = 'breaks',
  Conflicts = 'conflicts',
  Depends = 'depends',
  Recommends = 'recommends',
  Suggests = 'suggests',
}

export type TErrorWithCount = {
  __typename: 'ErrorWithCount',
  count: Scalars['Int'],
  description: Scalars['String'],
};

export type TGqlModDependency = {
  __typename: 'GqlModDependency',
  modId: Scalars['String'],
  type: DependencyType,
  versionRange?: Maybe<Scalars['String']>,
};

export type TModJar = {
  __typename: 'ModJar',
  downloadUrl: Scalars['String'],
  fileName: Scalars['String'],
  id: Scalars['ID'],
  mods: TModVersion[],
  project: TProject,
  releaseType: ReleaseType,
  /**
   *
   *       returns the list of jars from the same project that are considered updated versions to this jar.
   *
   */
  updatedVersion: TModJar[],
};

export type TModJarModsArgs = {
  matchingModpack?: Maybe<Scalars['ID']>,
};

export type TModJarUpdatedVersionArgs = {
  matchingModpack: Scalars['ID'],
};

export type TModJarConnection = {
  __typename: 'ModJarConnection',
  edges: TModJarEdge[],
  nodes: TModJar[],
  pageInfo: TPageInfo,
  totalCount: Scalars['Int'],
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
  id: Scalars['ID'],
  modId: Scalars['String'],
  modVersion: Scalars['String'],
  name: Scalars['String'],
  supportedMinecraftVersions: Array<Scalars['String']>,
  supportedModLoader: ModLoader,
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
  versionIndex: Scalars['Int'],
};

export type TMutation = {
  __typename: 'Mutation',
  addJarToModpack: TAddJarToModpackPayload,
  createModpack: TCreateModpackPayload,
  createNewModpackVersion: TCreateNewModpackVersionPayload,
  removeJarFromModpack: TRemoveJarFromModpackPayload,
  replaceModpackJar: TReplaceModpackJarPayload,
  setModpackJarIsLibrary: TSetModpackJarIsLibraryPayload,
};

export type TMutationAddJarToModpackArgs = {
  input: TAddJarToModpackInput,
};

export type TMutationCreateModpackArgs = {
  input: TCreateModpackInput,
};

export type TMutationCreateNewModpackVersionArgs = {
  input: TCreateNewModpackVersionInput,
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
  id: Scalars['String'],
  jars: TModJarConnection[],
  longDescription: Scalars['String'],
  /**
   * Works like `longDescription`,
   * but returns null if the the value has not been loaded & cached yet.
   */
  longDescriptionIfReady?: Maybe<Scalars['String']>,
  name: Scalars['String'],
  source: ProjectSource,
  sourceId: Scalars['String'],
};

export type TProjectJarsArgs = {
  after?: Maybe<Scalars['String']>,
  before?: Maybe<Scalars['String']>,
  first?: Maybe<Scalars['Int']>,
  last?: Maybe<Scalars['Int']>,
  limit?: Maybe<Scalars['Int']>,
  offset?: Maybe<Scalars['Int']>,
};

export type TProjectConnection = {
  __typename: 'ProjectConnection',
  edges: TProjectEdge[],
  nodes: TProject[],
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
  jar?: Maybe<TModJar>,
  /**
   *
   * *Returns the jars of a project matching the search query.*
   * Uses [lucene syntax](https://lucene.apache.org/core/2_9_4/queryparsersyntax.html)
   *
   * ### Supported fields (mods):
   *
   * Mods fields combinations `(modLoader AND minecraftVersion)` are checked per-mod instead of per-jar.
   * this means that if a jar includes two mods, one that supports modLoader and one that supports minecraftVersion, but not
   * both at the same time, it will not be returned. A single mod needs to support both to be returned.
   *
   * - **modId** - returns only projects that have at least one jar containing this modId.
   * - **modName** - returns only projects that have at least one jar containing one mod that matches modName.
   * - **minecraftVersion** - returns only projects that have at least one jar containing one mod that supports minecraftVersion.
   * - **modLoader** - returns only projects that have at least one jar containing one mod that uses this modLoader.
   *
   * ### Supported fields (jars):
   * Project fields combinations are checked per-projects.
   *
   * - **fileName** - returns only jars whose fileName matches this.
   *
   * ---
   *
   * If no field is provided (Example 2), it'll be interpreted as a wildcard search on the fileName field.
   *
   * Example 1: `modLoader:FORGE minecraftVersion:(1.16.4 OR 1.16.5)`
   * Example 2: `Quark-r2.4-315` (interpreted as `fileName:"*Quark-r2.4-315*"`).
   *
   */
  jars: TModJarConnection,
  modpack?: Maybe<TModpack>,
  modpacks: TModpack[],
  project?: Maybe<TProject>,
  projectErrors: TErrorWithCount[],
  /**
   *
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
   *
   */
  projects: TProjectConnection,
};

export type TQueryJarArgs = {
  id: Scalars['ID'],
};

export type TQueryJarsArgs = {
  after?: Maybe<Scalars['String']>,
  before?: Maybe<Scalars['String']>,
  first?: Maybe<Scalars['Int']>,
  last?: Maybe<Scalars['Int']>,
  limit?: Maybe<Scalars['Int']>,
  offset?: Maybe<Scalars['Int']>,
  project: Scalars['ID'],
  query?: Maybe<Scalars['String']>,
};

export type TQueryModpackArgs = {
  id: Scalars['ID'],
};

export type TQueryProjectArgs = {
  id: Scalars['ID'],
};

export type TQueryProjectsArgs = {
  after?: Maybe<Scalars['String']>,
  before?: Maybe<Scalars['String']>,
  first?: Maybe<Scalars['Int']>,
  last?: Maybe<Scalars['Int']>,
  limit?: Maybe<Scalars['Int']>,
  offset?: Maybe<Scalars['Int']>,
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
  newJars: Array<Scalars['ID']>,
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

export type TAddJarToModpackMutationVariables = Exact<{
  input: TAddJarToModpackInput,
}>;

export type TAddJarToModpackMutation = { __typename: 'Mutation', addJarToModpack: { __typename: 'AddJarToModpackPayload', error?: { __typename: 'AddJarToModpackError', code: AddJarToModpackErrorCodes } | null | undefined, node?: { __typename: 'ModpackVersion', id: string } | null | undefined } };

export type TCreateModpackMutationVariables = Exact<{
  input: TCreateModpackInput,
}>;

export type TCreateModpackMutation = { __typename: 'Mutation', createModpack: { __typename: 'CreateModpackPayload', node?: { __typename: 'Modpack', id: string, lastVersionIndex: number } | null | undefined } };

export type TCreateNewModpackVersionMutationVariables = Exact<{
  input: TCreateNewModpackVersionInput,
}>;

export type TCreateNewModpackVersionMutation = { __typename: 'Mutation', createNewModpackVersion: { __typename: 'CreateNewModpackVersionPayload', error?: { __typename: 'CreateNewModpackVersionError', code: CreateNewModpackVersionErrorCodes } | null | undefined, node?: { __typename: 'ModpackVersion', versionIndex: number } | null | undefined } };

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

export type TJarModalQueryVariables = Exact<{
  id: Scalars['ID'],
}>;

export type TJarModalQuery = { __typename: 'Query', jar?: { __typename: 'ModJar', id: string, downloadUrl: string, fileName: string, releaseType: ReleaseType, mods: Array<{ __typename: 'ModVersion', id: string, modId: string, modVersion: string, name: string, supportedMinecraftVersions: string[], supportedModLoader: ModLoader, dependencies: Array<{ __typename: 'GqlModDependency', modId: string, type: DependencyType, versionRange?: string | null | undefined }> }> } | null | undefined };

export type TProjectPageQueryVariables = Exact<{
  id: Scalars['ID'],
}>;

export type TProjectPageQuery = { __typename: 'Query', project?: { __typename: 'Project', id: string, iconUrl: string, description: string, longDescriptionIfReady?: string | null | undefined, homepage: string, source: ProjectSource, name: string, sourceId: string } | null | undefined };

export type TProjectDescriptionQueryVariables = Exact<{
  id: Scalars['ID'],
}>;

export type TProjectDescriptionQuery = { __typename: 'Query', project?: { __typename: 'Project', longDescriptionIfReady?: string | null | undefined } | null | undefined };

export type TProjectPageJarsQueryVariables = Exact<{
  id: Scalars['ID'],
  offset: Scalars['Int'],
  limit: Scalars['Int'],
  query: Scalars['String'],
}>;

export type TProjectPageJarsQuery = { __typename: 'Query', jars: { __typename: 'ModJarConnection', totalCount: number, nodes: Array<{ __typename: 'ModJar', id: string, fileName: string, releaseType: ReleaseType, downloadUrl: string, mods: Array<{ __typename: 'ModVersion', id: string, modId: string, modVersion: string, name: string, supportedMinecraftVersions: string[], supportedModLoader: ModLoader }> }> } };

export type TProjectSearchQueryVariables = Exact<{
  query: Scalars['String'],
  offset: Scalars['Int'],
  limit: Scalars['Int'],
  order: ProjectSearchSortOrder,
  orderDir: ProjectSearchSortOrderDirection,
}>;

export type TProjectSearchQuery = { __typename: 'Query', projects: { __typename: 'ProjectConnection', totalCount: number, edges: Array<{ __typename: 'ProjectEdge', cursor: string, node: { __typename: 'Project', id: string, iconUrl: string, name: string, description: string, homepage: string, source: ProjectSource } }> } };

export type TErrorsPageQueryVariables = Exact<{ [key: string]: never }>;

export type TErrorsPageQuery = { __typename: 'Query', projectErrors: Array<{ __typename: 'ErrorWithCount', description: string, count: number }> };

export type TModpackViewQueryVariables = Exact<{
  modpackId: Scalars['ID'],
  versionIndex: Scalars['Int'],
}>;

export type TModpackViewQuery = { __typename: 'Query', modpack?: { __typename: 'Modpack', id: string, minecraftVersion: string, modLoader: ModLoader, name: string, version?: { __typename: 'ModpackVersion', id: string, downloadUrl: string, name: string, installedJars: Array<{ __typename: 'ModpackMod', addedAt: string, isLibraryDependency: boolean, jar: { __typename: 'ModJar', id: string, downloadUrl: string, fileName: string, releaseType: ReleaseType, updatedVersion: Array<{ __typename: 'ModJar', fileName: string, id: string, releaseType: ReleaseType }>, project: { __typename: 'Project', id: string }, mods: Array<{ __typename: 'ModVersion', id: string, modId: string, modVersion: string, name: string, supportedMinecraftVersions: string[], supportedModLoader: ModLoader, dependencies: Array<{ __typename: 'GqlModDependency', modId: string, versionRange?: string | null | undefined, type: DependencyType }> }> } }> } | null | undefined } | null | undefined };

export type TModpackFragment = { __typename: 'Modpack', id: string, minecraftVersion: string, modLoader: ModLoader, name: string, version?: { __typename: 'ModpackVersion', id: string, downloadUrl: string, name: string, installedJars: Array<{ __typename: 'ModpackMod', addedAt: string, isLibraryDependency: boolean, jar: { __typename: 'ModJar', id: string, downloadUrl: string, fileName: string, releaseType: ReleaseType, project: { __typename: 'Project', id: string }, mods: Array<{ __typename: 'ModVersion', id: string, modId: string, modVersion: string, name: string, supportedMinecraftVersions: string[], supportedModLoader: ModLoader, dependencies: Array<{ __typename: 'GqlModDependency', modId: string, versionRange?: string | null | undefined, type: DependencyType }> }> } }> } | null | undefined };

export type TModpackListViewQueryVariables = Exact<{ [key: string]: never }>;

export type TModpackListViewQuery = { __typename: 'Query', modpacks: Array<{ __typename: 'Modpack', id: string, minecraftVersion: string, modLoader: ModLoader, name: string, lastVersionIndex: number }> };

export const ModpackFragmentDoc = /* #__PURE__ */ gql`
    fragment Modpack on Modpack {
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
        project {
          id
        }
        mods(matchingModpack: $modpackId) {
          id
          modId
          modVersion
          name
          supportedMinecraftVersions
          supportedModLoader
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
    `;
export const AddJarToModpackDocument = /* #__PURE__ */ gql`
    mutation AddJarToModpack($input: AddJarToModpackInput!) {
  addJarToModpack(input: $input) {
    error {
      code
    }
    node {
      id
    }
  }
}
    `;

export function useAddJarToModpackMutation() {
  return Urql.useMutation<TAddJarToModpackMutation, TAddJarToModpackMutationVariables>(AddJarToModpackDocument);
}

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

export const CreateNewModpackVersionDocument = /* #__PURE__ */ gql`
    mutation CreateNewModpackVersion($input: CreateNewModpackVersionInput!) {
  createNewModpackVersion(input: $input) {
    error {
      code
    }
    node {
      versionIndex
    }
  }
}
    `;

export function useCreateNewModpackVersionMutation() {
  return Urql.useMutation<TCreateNewModpackVersionMutation, TCreateNewModpackVersionMutationVariables>(CreateNewModpackVersionDocument);
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

export const JarModalDocument = /* #__PURE__ */ gql`
    query JarModal($id: ID!) {
  jar(id: $id) {
    id
    downloadUrl
    fileName
    releaseType
    mods {
      id
      modId
      modVersion
      name
      supportedMinecraftVersions
      supportedModLoader
      dependencies {
        modId
        type
        versionRange
      }
    }
  }
}
    `;

export function useJarModalQuery(options: Omit<Urql.UseQueryArgs<TJarModalQueryVariables>, 'query'> = {}) {
  return Urql.useQuery<TJarModalQuery>({ query: JarModalDocument, ...options });
}

export const ProjectPageDocument = /* #__PURE__ */ gql`
    query ProjectPage($id: ID!) {
  project(id: $id) {
    id
    iconUrl
    description
    longDescriptionIfReady
    homepage
    source
    name
    sourceId
  }
}
    `;

export function useProjectPageQuery(options: Omit<Urql.UseQueryArgs<TProjectPageQueryVariables>, 'query'> = {}) {
  return Urql.useQuery<TProjectPageQuery>({ query: ProjectPageDocument, ...options });
}

export const ProjectDescriptionDocument = /* #__PURE__ */ gql`
    query ProjectDescription($id: ID!) {
  project(id: $id) {
    longDescriptionIfReady
  }
}
    `;

export function useProjectDescriptionQuery(options: Omit<Urql.UseQueryArgs<TProjectDescriptionQueryVariables>, 'query'> = {}) {
  return Urql.useQuery<TProjectDescriptionQuery>({ query: ProjectDescriptionDocument, ...options });
}

export const ProjectPageJarsDocument = /* #__PURE__ */ gql`
    query ProjectPageJars($id: ID!, $offset: Int!, $limit: Int!, $query: String!) {
  jars(project: $id, offset: $offset, limit: $limit, query: $query) {
    nodes {
      id
      fileName
      releaseType
      downloadUrl
      mods {
        id
        modId
        modVersion
        name
        supportedMinecraftVersions
        supportedModLoader
      }
    }
    totalCount
  }
}
    `;

export function useProjectPageJarsQuery(options: Omit<Urql.UseQueryArgs<TProjectPageJarsQueryVariables>, 'query'> = {}) {
  return Urql.useQuery<TProjectPageJarsQuery>({ query: ProjectPageJarsDocument, ...options });
}

export const ProjectSearchDocument = /* #__PURE__ */ gql`
    query ProjectSearch($query: String!, $offset: Int!, $limit: Int!, $order: ProjectSearchSortOrder!, $orderDir: ProjectSearchSortOrderDirection!) {
  projects(
    query: $query
    offset: $offset
    limit: $limit
    order: $order
    orderDir: $orderDir
  ) {
    totalCount
    edges {
      cursor
      node {
        id
        iconUrl
        name
        description
        homepage
        source
      }
    }
  }
}
    `;

export function useProjectSearchQuery(options: Omit<Urql.UseQueryArgs<TProjectSearchQueryVariables>, 'query'> = {}) {
  return Urql.useQuery<TProjectSearchQuery>({ query: ProjectSearchDocument, ...options });
}

export const ErrorsPageDocument = /* #__PURE__ */ gql`
    query ErrorsPage {
  projectErrors {
    description
    count
  }
}
    `;

export function useErrorsPageQuery(options: Omit<Urql.UseQueryArgs<TErrorsPageQueryVariables>, 'query'> = {}) {
  return Urql.useQuery<TErrorsPageQuery>({ query: ErrorsPageDocument, ...options });
}

export const ModpackViewDocument = /* #__PURE__ */ gql`
    query ModpackView($modpackId: ID!, $versionIndex: Int!) {
  modpack(id: $modpackId) {
    ...Modpack
    version(index: $versionIndex) {
      installedJars {
        jar {
          updatedVersion(matchingModpack: $modpackId) {
            fileName
            id
            releaseType
          }
        }
      }
    }
  }
}
    ${ModpackFragmentDoc}`;

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
