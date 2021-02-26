import { useRouter } from 'next/router';
import { useGraphQl } from '../../api/graphql';
import { isLoadedSwr } from '../../api/swr';
import DropZone, { getAsStringAsync } from '../../components/dropzone';
import { ComponentProps, useCallback, useEffect, useMemo } from 'react';
import css from './[id].module.scss';
import { addModToModpack } from '../../api/add-mod-to-modpack';
import { assertIsString } from '../../utils/typing';
import { CircularProgress, List, ListItem } from '@material-ui/core';
import classnames from 'classnames';
import { getMostCompatibleMcVersion, parseMinecraftVersion } from '../../../common/minecraft-utils';
import { HelpOutlined } from '@material-ui/icons';
import { TModpack, TModpackMod, TModVersion } from '../../api/schema-typings';
import { removeJarFromModpack } from '../../api/remove-jar-from-modpack';
import { MoreMenu } from '../../components/action-menu';
import { setModpackJarIsLibrary } from '../../api/set-modpack-jar-is-library';

// TODO: if a new version is available but is less stable, display "BETA AVAILABLE" or "ALPHA AVAILABLE" in the "up to date" field
//  else display "STABLE UPDATE AVAILABLE"

// TODO: warn for duplicate modIds
// TODO: differentiate optional & required dependencies
// TODO

export default function ModpackRoute() {
  const router = useRouter();
  const { id } = router.query;

  if (!id) {
    return null;
  }

  assertIsString(id);

  return (
    <ModpackView id={id} />
  );
}

function ModpackView(props: { id: string }) {
  const { id } = props;

  assertIsString(id);

  const swr = useData(id);

  const onDrop = useCallback(async data => {
    await addModToModpack({
      byUrl: data.items,
      modpackId: id,
    });

    await swr.revalidate();
  }, [id]);

  useEffect(() => {
    const modpack = swr.data?.modpack;

    if (!modpack) {
      return;
    }

    let timeout;
    if (modpack.processingCount > 0) {
      timeout = setTimeout(() => {
        swr.revalidate();
      }, 4000);
    }

    return () => clearTimeout(timeout);
  }, [swr]);

  if (!isLoadedSwr(swr)) {
    return 'loading';
  }

  if (swr.error) {
    return 'error';
  }

  const modpack = swr.data?.modpack;
  if (!modpack) {
    return '404';
  }

  return (
    <>
      <DropZone onDrop={onDrop} itemFilter={urlItemFilter} className={css.dropZone}>
        <div className={css.container}>
          <h1>{modpack.name} Modpack</h1>
          <p>{modpack.minecraftVersion}</p>
          <p>{modpack.modLoader}</p>
          <button>Download All Mods</button>
          <button>Add Mod</button>
          <button>Edit modpack details</button>

          <h2>Mod List ({modpack.modJars.length} mods, {modpack.processingCount} processing)</h2>
          {modpack.processingCount > 0 && (
            <>
              <CircularProgress />
              <p>We're processing the mods you added, please stand by.</p>
            </>
          )}
          <List>
            {modpack.modJars.filter(mod => !mod.isLibraryDependency).map(mod => {
              return <JarListItem key={mod.jar.id} installedMod={mod} modpack={modpack} onChange={swr.revalidate} />;
            })}
          </List>
          <h2>Libraries</h2>
          <p>Put in this section the mods that are library dependencies of other mods, we'll tell you if they can be safely removed.</p>
          <List>
            {modpack.modJars.filter(mod => mod.isLibraryDependency).map(mod => {
              return <JarListItem key={mod.jar.id} installedMod={mod} modpack={modpack} onChange={swr.revalidate} />;
            })}
          </List>
        </div>
      </DropZone>
    </>
  );
}

function JarListItem(props: { installedMod: TModpackMod, modpack: TModpack, onChange: () => void }) {
  const { installedMod, modpack, onChange } = props;

  const jar = installedMod.jar;

  if (jar.mods.length === 1) {
    return <ModListItem mod={jar.mods[0]} installedMod={installedMod} modpack={modpack} onChange={onChange} title={jar.fileName} />;
  }

  return (
    <li style={{ background: 'rgb(0 0 0 / 0.2)', padding: '16px', borderRadius: '8px' }}>
      <h3>{jar.fileName}</h3>
      <p>This file contains more than one mod</p>
      <JarListItem installedMod={installedMod} modpack={modpack} onChange={onChange} />
      <List>
        {jar.mods.map(mod => {
          return <ModListItem mod={mod} installedMod={installedMod} modpack={modpack} onChange={onChange} disableActions />;
        })}
      </List>
    </li>
  );
}

function JarActions(props: { jar: TModpackMod, modpack: TModpack, onChange: () => void }) {
  const { onChange, jar, modpack } = props;

  const jarId = jar.jar.id;

  const removeJar = useCallback(async () => {
    await removeJarFromModpack({
      jarId: jarId,
      modpackId: modpack.id,
    });

    onChange();
  }, [onChange, jarId, modpack.id]);

  const isLibrary = props.jar.isLibraryDependency;
  const switchModType = useCallback(async () => {
    await setModpackJarIsLibrary({
      isLibrary: !isLibrary,
      jarId,
      modpackId: modpack.id,
    });

    onChange();
  }, [jarId, modpack.id, isLibrary]);

  return (
    <div className={css.actions}>
      <button>Store Page</button>
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
            onClick: () => {
              alert('NYI');
            },
            title: 'Download',
          },
          {
            key: 2,
            onClick: switchModType,
            title: isLibrary ? 'Move to mod list' : 'Move to Automatic Dependencies',
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
  mod: TModVersion,
  installedMod: TModpackMod,
  disableActions?: boolean,
  onChange: () => void,
  title?: string,
};

function ModListItem(props: TModListItemProps) {
  const { mod, modpack, installedMod, onChange } = props;

  // TODO: warn for MC version
  // TODO: warn if dependency is missing

  const mostCompatibleMcVersion = useMemo(
    () => getMostCompatibleMcVersion(modpack.minecraftVersion, mod.supportedMinecraftVersions),
    [modpack.minecraftVersion, mod.supportedMinecraftVersions],
  );

  const requestedMcVersion = parseMinecraftVersion(modpack.minecraftVersion);
  const availableMinecraftVersion = parseMinecraftVersion(mostCompatibleMcVersion);
  const isMcProbablyCompatible = requestedMcVersion.major === availableMinecraftVersion.major
    && requestedMcVersion.minor >= availableMinecraftVersion.minor;

  const missingDependencies = useMemo(() => {
    const missing = [];
    for (const dependency of mod.dependencies) {
      const modId = dependency.modId;

      if (modId === 'forge') {
        continue;
      }

      if (modpack.modJars.find(jar => jar.jar.mods.find(mod => mod.modId === modId) != null) == null) {
        missing.push(modId);
      }
    }

    return missing;
  }, [mod.dependencies, modpack.modJars]);

  const usedBy = useMemo(() => {
    const ids = [];

    for (const installedJar of modpack.modJars) {
      for (const installedMod of installedJar.jar.mods) {
        if (installedMod.dependencies.find(dep => dep.modId === mod.modId) != null) {
          ids.push(installedMod.modId);
        }
      }
    }

    return ids;
  }, [mod.modId, modpack.modJars]);

  return (
    <ListItem title={props.title}>
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
            <><br/>Used by {usedBy.join(', ')}</>
          )}
        </p>
        {/*<Tag>Update available!</Tag>*/}
        {/*<Tag>Beta available!</Tag>*/}
        {/*<Tag>Alpha available!</Tag>*/}
        <div className={css.tags}>
          {mod.supportedModLoader != modpack.modLoader && (
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
            <Tag type="error" title={`This mod depends on ${dependency}, but that mod is missing from your modpack.`}>
              Missing dependency {dependency}
              <button>Add</button>
              <HelpOutlined />
            </Tag>
          ))}
        </div>
      </div>
      {!props.disableActions && (
        <JarActions jar={installedMod} modpack={modpack} onChange={onChange} />
      )}
    </ListItem>
  );
}

function Tag(props: ComponentProps<'div'> & { type: 'error' | 'warn' }) {
  const { type, ...passDown } = props;
  return <div {...passDown} className={classnames(css.tag, css[type])} />;
}

function useData(modpackId: string) {
  return useGraphQl<{ modpack: TModpack | null }, Error>({
    // language=GraphQL
    query: `
      query Data($id: ID!) {
        modpack(id: $id) {
          id
          minecraftVersion
          modLoader
          processingCount
          name
          modJars {
            addedAt
            isLibraryDependency
            jar {
              id
              downloadUrl
              fileName
              releaseType
              mods {
                modId
                modVersion
                name
                supportedMinecraftVersions
                supportedModLoader
                dependencies {
                  modId
                  versionRange
                }
              }
            }
          }
        }
      }
    `,
    variables: {
      id: modpackId,
    },
  });
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
