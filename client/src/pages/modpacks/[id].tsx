import { CircularProgress, List, ListItem } from '@material-ui/core';
import { HelpOutlined } from '@material-ui/icons';
import classnames from 'classnames';
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { DependencyType } from '../../../../common/dependency-type';
import {
  getMostCompatibleMcVersion,
  isMcVersionLikelyCompatibleWith,
  parseMinecraftVersion,
} from '../../../../common/minecraft-utils';
import { assertIsString } from '../../../../common/typing-utils';
import {
  useAddModToModpackMutation,
  useModpackViewQuery,
  useRemoveJarFromModpackMutation, useReplaceModpackJarMutation, useSetModpackJarIsLibraryMutation,
} from '../../api/graphql.generated';
import { isLoadedUrql } from '../../api/urql';
import { MoreMenu } from '../../components/action-menu';
import { AnyLink } from '../../components/any-link';
import DropZone, { getAsStringAsync } from '../../components/dropzone';
import css from './[id].module.scss';

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

export default function ModpackRoute() {
  const router = useRouter();
  const { id } = router.query;

  if (!id) {
    return null;
  }

  assertIsString(id);

  useEffect(() => {
    document.documentElement.classList.add(css.html);

    return () => {
      document.documentElement.classList.remove(css.html);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Modpack</title>
      </Head>
      <ModpackView id={id} />
    </>
  );
}

function ModpackView(props: { id: string }) {
  const { id } = props;

  assertIsString(id);

  const urql = useModpackViewQuery({
    variables: { id },
  });

  const callAddModToModpack = useAddModToModpackMutation();
  const onDrop = useCallback(async data => {
    await callAddModToModpack({
      byUrl: data.items,
      modpackId: id,
    });

    await urql.revalidate();
  }, [id]);

  useEffect(() => {
    const modpack = urql.data?.modpack;

    if (!modpack) {
      return;
    }

    let timeout;
    if (modpack.processingCount > 0) {
      timeout = setTimeout(() => {
        urql.revalidate();
      }, 4000);
    }

    return () => clearTimeout(timeout);
  }, [urql]);

  const modpack = urql.data?.modpack;
  const lists = useMemo(() => {
    const output = {
      mods: [],
      libraries: [],
      incompatible: [],
    };

    if (!modpack) {
      return output;
    }

    for (const jar of modpack.modJars) {
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

  if (!isLoadedUrql(urql)) {
    return 'loading';
  }

  if (urql.error) {
    return 'error';
  }

  if (!modpack) {
    return '404';
  }

  return (
    <>
      <DropZone onDrop={onDrop} itemFilter={urlItemFilter} className={css.dropZone}>
        <div className={css.container}>
          <h1>{modpack.name} Modpack</h1>
          <p>Minecraft {modpack.minecraftVersion}</p>
          <p>{modpack.modLoader}</p>
          <AnyLink href={modpack.downloadUrl}>Download Modpack</AnyLink>
          <button>Add Mod</button>
          <button>Edit modpack details</button>

          <h2>Mod List ({modpack.modJars.length} mods, {modpack.processingCount} processing)</h2>
          <List>
            {lists.mods.map(mod => {
              return <JarListItem key={mod.jar.id} installedMod={mod} modpack={modpack} onChange={urql.revalidate} />;
            })}
          </List>
          {modpack.processingCount > 0 && (
            <div className={css.processingRow}>
              <CircularProgress />
              <p>We're processing the mods you added, please stand by.</p>
            </div>
          )}
          <h2>Libraries</h2>
          <p>Put in this section the mods that are library dependencies of other mods, we'll tell you if they can be safely removed.</p>
          <List>
            {lists.libraries.map(mod => {
              return <JarListItem key={mod.jar.id} installedMod={mod} modpack={modpack} onChange={urql.revalidate} />;
            })}
          </List>
          {lists.incompatible.length > 0 && (
            <>
              <h2>Incompatible Mods</h2>
              <p>These mods are not included in your modpack, but we'll check if a compatible update is published.</p>
              <List>
                {lists.incompatible.map(mod => {
                  return <JarListItem key={mod.jar.id} installedMod={mod} modpack={modpack} onChange={urql.revalidate} />;
                })}
              </List>
            </>
          )}
        </div>
      </DropZone>
    </>
  );
}

function JarListItem(props: { installedMod: TModpackMod, modpack: TModpack, onChange(): void }) {
  const { installedMod, modpack, onChange } = props;

  const jar = installedMod.jar;

  if (jar.mods.length === 1) {
    return <ModListItem mod={jar.mods[0]} installedMod={installedMod} modpack={modpack} onChange={onChange} title={jar.fileName} />;
  }

  return (
    <li className={css.jarListItem}>
      <div className={css.jarListHeading}>
        <div>
          <h3>{jar.fileName}</h3>
          <p>This file contains more than one mod</p>
        </div>
        <JarActions jar={installedMod} modpack={modpack} onChange={onChange} />
      </div>
      <List>
        {jar.mods.map(mod => {
          return <ModListItem mod={mod} installedMod={installedMod} modpack={modpack} onChange={onChange} disableActions />;
        })}
      </List>
    </li>
  );
}

function JarActions(props: { jar: TModpackMod, modpack: TModpack, onChange(): void }) {
  const { onChange, jar, modpack } = props;

  const jarId = jar.jar.id;

  const callRemoveJarFromModpack = useRemoveJarFromModpackMutation();
  const removeJar = useCallback(async () => {
    await callRemoveJarFromModpack({
      jarId,
      modpackId: modpack.id,
    });

    onChange();
  }, [onChange, jarId, modpack.id]);

  const isLibrary = props.jar.isLibraryDependency;
  const callSetModpackJarIsLibrary = useSetModpackJarIsLibraryMutation();
  const switchModType = useCallback(async () => {
    await callSetModpackJarIsLibrary({
      isLibrary: !isLibrary,
      jarId,
      modpackId: modpack.id,
    });

    onChange();
  }, [jarId, modpack.id, isLibrary]);

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
  mod: TModVersion,
  installedMod: TModpackMod,
  disableActions?: boolean,
  onChange(): void,
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
      if (dependency.type !== DependencyType.depends) {
        continue;
      }

      const modId = dependency.modId;

      if (modId === 'forge' || modId === 'fabric' || modId === 'fabricloader') {
        continue;
      }

      if (modpack.modJars.find(jar => jar.jar.mods.find(mod => mod.modId === modId) != null) == null) {
        missing.push(modId);
      }
    }

    return missing.sort();
  }, [mod.dependencies, modpack.modJars]);

  const usedBy = useMemo(() => {
    const ids = new Set();

    for (const installedJar of modpack.modJars) {
      for (const installedMod of installedJar.jar.mods) {
        if (installedMod.dependencies.find(dep => dep.modId === mod.modId) != null) {
          ids.add(installedMod.modId);
        }
      }
    }

    return Array.from(ids).sort();
  }, [mod.modId, modpack.modJars]);

  const callReplaceModpackJar = useReplaceModpackJarMutation();
  const installUpdatedVersion = useCallback(async () => {
    await callReplaceModpackJar({
      modpackId: modpack.id,
      newJarId: mod.updatedVersion.id,
      oldJarId: installedMod.jar.id,
    });

    // TODO error handling

    onChange();
  }, [mod, installedMod.jar, modpack.id, onChange]);

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
                <>
                  <a href={`#${modId}`}>{modId}</a>
                  {' '}
                </>
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
            <Tag type="error" title={`This mod depends on ${dependency}, but that mod is missing from your modpack.`}>
              Missing dependency {dependency}
              <button>Add</button>
              <HelpOutlined />
            </Tag>
          ))}
          {mod.updatedVersion && (
            <Tag type="info">
              update available: {mod.updatedVersion.fileName}
              <button type="button" onClick={installUpdatedVersion}>install</button>
            </Tag>
          )}
        </div>
      </div>
      {!props.disableActions && (
        <JarActions jar={installedMod} modpack={modpack} onChange={onChange} />
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
