import { HelpOutlined } from '@mui/icons-material';
import { Button, CircularProgress, List, ListItem } from '@mui/material';
import classnames from 'classnames';
import type { ComponentProps } from 'react';
import { Fragment, useCallback, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useHistory, useParams } from 'react-router-dom';
import {
  getFirstSemverMajorVersion,
  getMostCompatibleMcVersion,
  isMcVersionLikelyCompatibleWith,
  parseMinecraftVersionThrows,
} from '../../../common/minecraft-utils';
import { uriTag } from '../../../common/url-utils';
import type { TModpackViewQuery } from '../api/graphql.generated';
import {
  DependencyType,
  useCreateNewModpackVersionMutation,
  useModpackViewQuery,
  useRemoveJarFromModpackMutation,
  useReplaceModpackJarMutation,
  useSetModpackJarIsLibraryMutation,
} from '../api/graphql.generated';
import { isLoadedUrql } from '../api/urql';
import { MoreMenu } from '../components/action-menu';
import { AnyLink } from '../components/any-link';
import DropZone, { getAsStringAsync } from '../components/dropzone';
import { ProjectPageModal, URL_KEY_PROJECT_PAGE } from '../components/project-page';
import { ProjectSearchModal, URL_KEY_PROJECT_LIBRARY_PAGE } from '../components/project-search';
import { UrqlErrorDisplay } from '../components/urql-error-display';
import { useSearchParams } from '../utils/use-search-params';
import css from './modpack.module.scss';

// TODO: button "compare with previous version" which displays the list of changelogs

// TODO: if a new version is available but is less stable, display "BETA AVAILABLE" or "ALPHA AVAILABLE" in the "up to date" field
//  else display "STABLE UPDATE AVAILABLE"

// TODO: confirm when removing mod + add undo snack
// TODO: warn for duplicate modIds
// TODO: check Glimmering Potions extracts their dependencies
// TODO: option to sort by add date or by alphabetical order
// TODO: display warn if there are missing deps of type "recommends"
// TODO: display warn if there are deps of type "breaks"
// TODO: display error if there are deps of type "conflicts"
// TODO: don't include incompatible-mods in "Required by"
// TODO: don't mark mod dependency as available if the jar in question is in "incompatible" list
// TODO: only download mods that are compatible with pack
// TODO: ability to disable mods (but keep them in the list)
// TODO: ability to create versions of the modpack. Once a version is ready, user can click "create new version"
//  and can go back to previous version.
//  also display what changed since previous version using colored bullets
// TODO: display sticky info bar at top:
//  - modpack name
//  - how many mods
//  - how many libs
//  - how many processing
//  - how many incompatible mods
//  Clicking them jumps to section

type TModpackRouteParams = {
  modpackId: string,
  versionIndex: string,
};

export default function ModpackRoute() {
  const { modpackId, versionIndex: versionIndexStr } = useParams<TModpackRouteParams>();

  const versionIndex = Number(versionIndexStr);

  useEffect(() => {
    document.documentElement.classList.add(css.html);

    return () => {
      document.documentElement.classList.remove(css.html);
    };
  }, []);

  const urql = useModpackViewQuery({
    variables: {
      modpackId,
      versionIndex,
    },
  });

  const searchParams = useSearchParams();
  const projectSearchOpen = searchParams.get(URL_KEY_PROJECT_LIBRARY_PAGE) != null;
  const projectPageOpen = searchParams.get(URL_KEY_PROJECT_PAGE) != null;
  const history = useHistory();

  if (modpackId == null || versionIndexStr == null) {
    return null;
  }

  if (!isLoadedUrql(urql)) {
    return <CircularProgress />;
  }

  if (urql.error) {
    return <UrqlErrorDisplay urql={urql} />;
  }

  const modpack = urql.data.modpack;
  const modpackVersion = modpack?.version;
  if (!modpack || !modpackVersion) {
    return '404';
  }

  return (
    <>
      <Helmet>
        <title>Modpack</title>
      </Helmet>
      {/* TODO: display blurred version of modpack (image to reduce load) */}
      {!projectSearchOpen && !projectPageOpen && (
        <ModpackView modpack={modpack} modpackVersion={modpackVersion} />
      )}

      {projectSearchOpen && (
        <ProjectSearchModal
          // TODO: onClose should goBack until the search is closed
          onClose={history.goBack}
          baseFilters={[
            `modLoader:${modpack.modLoader}`,
            `minecraftVersion:[${getFirstSemverMajorVersion(modpack.minecraftVersion)} TO ${modpack.minecraftVersion}]`,
          ]}
        />
      )}
      {projectPageOpen && (
        // TODO: go back until modal is actually closed
        <ProjectPageModal onClose={history.goBack} />
      )}
    </>
  );
}

type TModpack = NonNullable<TModpackViewQuery['modpack']>;
type TModpackVersion = NonNullable<TModpack['version']>;
type TModpackMod = TModpackVersion['installedJars'][0];
type TJar = TModpackMod['jar'];

type Props = {
  modpack: TModpack,
  modpackVersion: TModpackVersion,
};

function ModpackView(props: Props) {
  const { modpack, modpackVersion } = props;

  const onDrop = useCallback(async _data => {
    // eslint-disable-next-line no-alert
    alert('dropping files is currently disabled');
  }, []);

  const lists = useMemo(() => {
    const output: { mods: TModpackMod[], libraries: TModpackMod[], incompatible: TModpackMod[] } = {
      mods: [],
      libraries: [],
      incompatible: [],
    };

    if (!modpack) {
      return output;
    }

    for (const jar of modpackVersion.installedJars) {
      if (jar.isLibraryDependency) {
        output.libraries.push(jar);
        continue;
      }

      const mod = jar.jar.mods[0];
      if (mod.supportedModLoader !== modpack.modLoader) {
        output.incompatible.push(jar);
        continue;
      }

      const mostCompatible = getMostCompatibleMcVersion(modpack.minecraftVersion, mod.supportedMinecraftVersions);
      if (!isMcVersionLikelyCompatibleWith(modpack.minecraftVersion, mostCompatible)) {
        output.incompatible.push(jar);
        continue;
      }

      output.mods.push(jar);
    }

    return output;
  }, [modpack]);

  const history = useHistory();
  const callCreateNewVersion = useCreateNewModpackVersionMutation();
  const finalizeVersion = useCallback(async () => {

    // TODO: error handling
    const res = await callCreateNewVersion({
      fromModpackVersion: modpackVersion.id,
      // TODO: popup for new version? or date
      name: 'test',
    });

    const newVersion = res.createNewModpackVersion.node;

    history.push(uriTag`/modpacks/${modpack.id}/${newVersion.versionIndex}`);
  }, []);

  return (
    <>
      <DropZone onDrop={onDrop} itemFilter={urlItemFilter} className={css.dropZone}>
        <div className={css.container}>
          <h1>{modpack.name} Modpack</h1>
          <p>Minecraft {modpack.minecraftVersion}</p>
          <p>{modpack.modLoader}</p>
          <AnyLink to={modpackVersion.downloadUrl}>Download Modpack</AnyLink>
          {' '}
          <AnyLink to={{ search: URL_KEY_PROJECT_LIBRARY_PAGE }}>Add Mod</AnyLink>
          <Button type="button" onClick={() => alert('nyi')}>Edit modpack details</Button>
          <Button type="button" onClick={finalizeVersion}>Finalize & Create new version</Button>

          <h2>Mod List ({modpackVersion.installedJars.length} mods)</h2>
          <List>
            {lists.mods.map(mod => {
              return <JarListItem key={mod.jar.id} installedMod={mod} modpack={modpack}
                modpackVersion={modpackVersion} />;
            })}
          </List>
          <h2>Libraries</h2>
          <p>
            Put in this section the mods that are library dependencies of other mods,
            we'll tell you if they can be safely removed.
          </p>
          <List>
            {lists.libraries.map(mod => {
              return <JarListItem key={mod.jar.id} installedMod={mod} modpack={modpack}
                modpackVersion={modpackVersion} />;
            })}
          </List>
          {lists.incompatible.length > 0 && (
            <>
              <h2>Incompatible Mods</h2>
              <p>These mods are not included in your modpack, but we'll check if a compatible update is published.</p>
              <List>
                {lists.incompatible.map(mod => {
                  return <JarListItem key={mod.jar.id} installedMod={mod}
                    modpack={modpack} modpackVersion={modpackVersion} />;
                })}
              </List>
            </>
          )}
        </div>
      </DropZone>
    </>
  );
}

type JarListItemProps = {
  installedMod: TModpackMod,
  modpackVersion: TModpackVersion,
  modpack: TModpack,
};

function JarListItem(props: JarListItemProps) {
  const { installedMod, modpackVersion, modpack } = props;

  const jar = installedMod.jar;

  if (jar.mods.length === 1) {
    return <ModListItem mod={jar.mods[0]} installedMod={installedMod} modpackVersion={modpackVersion}
      modpack={modpack} title={jar.fileName} jar={jar} />;
  }

  return (
    <li className={css.jarListItem}>
      <div className={css.jarListHeading}>
        <div>
          <h3>{jar.fileName}</h3>
          <p>This file contains more than one mod</p>
          <UpdateAvailableTag jar={jar} modpackVersion={modpackVersion} />
        </div>
        <JarActions jar={installedMod} modpackVersion={modpackVersion} />
      </div>
      <List>
        {jar.mods.map(mod => {
          return <ModListItem mod={mod} installedMod={installedMod} modpack={modpack}
            modpackVersion={modpackVersion} disableActions />;
        })}
      </List>
    </li>
  );
}

type TUpdateAvailableTagProps = {
  modpackVersion: { id: string },
  jar: TJar,
};

function UpdateAvailableTag(props: TUpdateAvailableTagProps) {
  const { modpackVersion, jar } = props;

  const callReplaceModpackJar = useReplaceModpackJarMutation();
  const installUpdatedVersion = useCallback(async () => {
    await callReplaceModpackJar({
      modpackVersion: modpackVersion.id,
      newJars: jar.updatedVersion.map(v => v.id),
      oldJar: jar.id,
    });

    // TODO error handling
  }, [jar, modpackVersion.id]);

  if (jar.updatedVersion.length === 0) {
    return null;
  }

  return (
    <Tag type="info">
      update available: {jar.updatedVersion.map(v => v.fileName).join(', ')}
      <button type="button" onClick={installUpdatedVersion}>install</button>
    </Tag>
  );
}

function JarActions(props: { jar: TModpackMod, modpackVersion: TModpackVersion }) {
  const { jar, modpackVersion } = props;

  const jarId = jar.jar.id;

  const callRemoveJarFromModpack = useRemoveJarFromModpackMutation();
  const removeJar = useCallback(async () => {
    await callRemoveJarFromModpack({
      jar: jarId,
      modpackVersion: modpackVersion.id,
    });
  }, [jarId, modpackVersion.id]);

  const isLibrary = props.jar.isLibraryDependency;
  const callSetModpackJarIsLibrary = useSetModpackJarIsLibraryMutation();
  const switchModType = useCallback(async () => {
    await callSetModpackJarIsLibrary({
      isLibrary: !isLibrary,
      jar: jarId,
      modpackVersion: modpackVersion.id,
    });
  }, [jarId, modpackVersion.id, isLibrary]);

  return (
    <div className={css.actions}>
      <a href={jar.jar.curseForgePage} target="_blank">Store Page</a>
      <MoreMenu
        actions={[
          {
            key: 0,
            onClick: () => {
              alert('NYI');
            },
            title: 'Change Version',
          },
          {
            key: 1,
            href: jar.jar.downloadUrl,
            title: 'Download',
          },
          {
            key: 2,
            onClick: switchModType,
            title: isLibrary ? 'Move to mod list' : 'Mark as Library',
          },
          {
            key: 3,
            onClick: removeJar,
            title: 'Remove from Modpack',
          },
        ]}
      />
    </div>
  );
}

type TModListItemProps = {
  modpack: TModpack,
  modpackVersion: TModpackVersion,
  mod: TJar['mods'][0],
  jar?: TJar,
  installedMod: TModpackMod,
  disableActions?: boolean,
  title?: string,
};

function ModListItem(props: TModListItemProps) {
  const { mod, jar, modpack, modpackVersion, installedMod } = props;

  // TODO: warn for MC version
  // TODO: warn if dependency is missing

  const mostCompatibleMcVersion = useMemo(
    () => getMostCompatibleMcVersion(modpack.minecraftVersion, mod.supportedMinecraftVersions),
    [modpack.minecraftVersion, mod.supportedMinecraftVersions],
  );

  const requestedMcVersion = parseMinecraftVersionThrows(modpack.minecraftVersion);
  const availableMinecraftVersion = parseMinecraftVersionThrows(mostCompatibleMcVersion);
  const isMcProbablyCompatible = requestedMcVersion.major === availableMinecraftVersion.major
    && requestedMcVersion.minor >= availableMinecraftVersion.minor;

  const missingDependencies = useMemo(() => {
    const missing = [];
    for (const dependency of mod.dependencies) {
      if (dependency.type !== DependencyType.Depends) {
        continue;
      }

      const modId = dependency.modId;

      if (modId === 'forge' || modId === 'fabric' || modId === 'fabricloader') {
        continue;
      }

      if (modpackVersion.installedJars.find(jar => jar.jar.mods.find(mod => mod.modId === modId) != null) == null) {
        missing.push(modId);
      }
    }

    return missing.sort();
  }, [mod.dependencies, modpackVersion.installedJars]);

  const usedBy: string[] = useMemo(() => {
    const ids = new Set<string>();

    for (const installedJar of modpackVersion.installedJars) {
      for (const installedMod of installedJar.jar.mods) {
        if (installedMod.dependencies.find(dep => dep.modId === mod.modId) != null) {
          ids.add(installedMod.modId);
        }
      }
    }

    return Array.from(ids).sort();
  }, [mod.modId, modpackVersion.installedJars]);

  return (
    <ListItem title={props.title} className={css.modListItem} id={mod.modId} >
      <div className={css.modListItemDetails}>
        <p>
          <strong>
            {mod.name}
            {' '}
            (<span className={css.modId} title="Mod ID">{mod.modId}</span>)
            {' '}
            <span className={css.modVersion}>{mod.modVersion}</span>
          </strong>
          {usedBy.length > 0 && (
            <><br/>Required by <span className={css.usedByList}>
              {usedBy.map(modId => (
                <Fragment key={modId}>
                  <a href={`#${modId}`}>{modId}</a>
                  {' '}
                </Fragment>
              ))}
            </span></>
          )}
        </p>
        {/* <Tag>Update available!</Tag> */}
        {/* <Tag>Beta available!</Tag> */}
        {/* <Tag>Alpha available!</Tag> */}
        <div className={css.tags}>
          {mod.supportedModLoader !== modpack.modLoader && (
            <Tag type="error" title="This mod does not support your mod loader">
              {mod.supportedModLoader} only
              <HelpOutlined />
            </Tag>
          )}
          {mostCompatibleMcVersion !== modpack.minecraftVersion && (
            <Tag
              type={isMcProbablyCompatible ? 'warn' : 'error'}
              title={isMcProbablyCompatible
                ? 'This mod does not explicitly support your minecraft version but could work'
                : 'This mod does not support your minecraft version'}
            >
              Minecraft {mostCompatibleMcVersion}
              <HelpOutlined />
            </Tag>
          )}
          {missingDependencies.map(dependency => (
            <Tag key={dependency} type="error" title={`This mod depends on ${dependency}, but that mod is missing from your modpack.`}>
              Missing dependency {dependency}
              <button>Add</button>
              <HelpOutlined />
            </Tag>
          ))}
          {jar && (
            <UpdateAvailableTag jar={jar} modpackVersion={modpackVersion} />
          )}
        </div>
      </div>
      {!props.disableActions && (
        <JarActions jar={installedMod} modpackVersion={modpackVersion} />
      )}
    </ListItem>
  );
}

function Tag(props: ComponentProps<'div'> & { type: 'error' | 'warn' | 'info' }) {
  const { type, ...passDown } = props;

  return <div {...passDown} className={classnames(css.tag, css[type])} />;
}

const supportedUrls = new Set(['text/uri-list', 'text/x-moz-url']);

async function urlItemFilter(items: DataTransferItemList) {
  const data = await Promise.all(
    Array.from(items)
      .filter(item => {
        return item.kind === 'string' && supportedUrls.has(item.type);
      })
      .map<Promise<string[]>>(async (item: DataTransferItem) => {
        return (await getAsStringAsync(item)).split('\n');
      }),
  );

  return data.flat()
    .map(item => item.trim())
    .filter((item: string) => {
      try {
        const uri = new URL(item);

        return uri.protocol === 'http:' || uri.protocol === 'https:';
      } catch (e) {
        return false;
      }
    });
}
