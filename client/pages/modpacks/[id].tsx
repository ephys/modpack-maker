import { useRouter } from 'next/router';
import { useGraphQl } from '../../api/graphql';
import { isLoadedSwr } from '../../api/swr';
import DropZone, { getAsStringAsync } from '../../components/dropzone';
import { ComponentProps, useCallback, useEffect, useMemo } from 'react';
import css from './[id].module.scss';
import { addModpackMod } from '../../api/add-modpack-mod';
import { assertIsString } from '../../utils/typing';
import { CircularProgress, List, ListItem } from '@material-ui/core';
import classnames from 'classnames';
import { parseMinecraftVersion } from '../../../common/minecraft-utils';
import { HelpOutlined } from '@material-ui/icons';

// TODO: if a new version is available but is less stable, display "BETA AVAILABLE" or "ALPHA AVAILABLE" in the "up to date" field
//  else display "STABLE UPDATE AVAILABLE"

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
    await addModpackMod({
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

          <h2>Mod List ({modpack.mods.length} mods, {modpack.processingCount} processing)</h2>
          {modpack.processingCount > 0 && (
            <>
              <CircularProgress />
              <p>We're processing the mods you added, please stand by.</p>
            </>
          )}
          <List>
            {modpack.mods.map(mod => {
              return <ModListItem key={mod.modId} mod={mod} modpack={modpack} />;
            })}
          </List>
          <h2>Automatic Dependencies</h2>
          <p>Mods in this category will be automatically removed if none of your mods need them</p>
        </div>
      </DropZone>
    </>
  );
}

function getMostCompatibleMcVersion(requestedStr: string, availableStr: string[]): string {
  const requested = parseMinecraftVersion(requestedStr);

  sqlSort(availableStr, [
    [item => parseMinecraftVersion(item).major === requested.major, 'DESC'],
    [item => parseMinecraftVersion(item).major < requested.major, 'DESC'],
    [item => parseMinecraftVersion(item).minor === requested.minor, 'DESC'],
    [item => parseMinecraftVersion(item).minor < requested.minor, 'DESC'],
    [item => parseMinecraftVersion(item).major, 'DESC'],
    [item => parseMinecraftVersion(item).minor, 'DESC'],
  ]);

  return availableStr[0];
}

function sqlSort<T>(array: T[], orders): T[] {
  return array.sort((a, b) => {
    for (const [order, direction] of orders) {
      const aValue = typeof order === 'function' ? order(a) : a[order];
      const bValue = typeof order === 'function' ? order(b) : b[order];

      const result = comparePrimitives(aValue, bValue);

      if (result !== 0) {
        return direction === 'DESC' ? -result : result;
      }
    }

    return 0;
  });
}

function comparePrimitives(a, b): number {
  const type = typeof a;
  if (type !== typeof b) {
    throw new Error('a & b do not have the same type');
  }

  if (type === 'string') {
    return a.localeCompare(b);
  }

  if (type === 'number' || type === 'bigint') {
    return a - b;
  }

  if (type === 'boolean') {
    if (a === b) {
      return 0;
    }

    if (a) {
      return 1;
    }

    if (b) {
      return -1;
    }
  }

  throw new Error('Unsupported type ' + type);
}

type TModListItemProps = {};

function ModListItem(props: TModListItemProps) {
  const { mod, modpack } = props;

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

      if (!modpack.mods.find(mod => mod.modId === modId)) {
        missing.push(modId);
      }
    }

    return missing;
  }, [mod.dependencies, modpack.mods]);

  return (
    <ListItem>
      {mod.name}
      {' '}
      (<span className={css.modId} title="Mod ID">{mod.modId}</span>)
      {' '}
      <span className={css.modVersion}>{mod.modVersion}</span>
      {!mod.supportedModLoaders.includes(modpack.modLoader) && (
        <Tag type="error" title="This mod does not support your mod loader">
          {mod.supportedModLoaders.join(', ')} only
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
      {/*<Tag>Update available!</Tag>*/}
      {/*<Tag>Beta available!</Tag>*/}
      {/*<Tag>Alpha available!</Tag>*/}
      {missingDependencies.map(dependency => (
        <Tag type="error" title={`This mod depends on ${dependency}, but that mod is missing from your modpack.`}>
          Missing dependency {dependency}
          <button>Add</button>
          <HelpOutlined />
        </Tag>
      ))}
      <div className={css.actions}>
        <button>Change version</button>
        <button>remove</button>
      </div>
    </ListItem>
  );
}

function Tag(props: ComponentProps<'span'> & { type: 'error' | 'warn' }) {
  const { type, ...passDown } = props;
  return <span {...passDown} className={classnames(css.tag, css[type])} />;
}

function useData(modpackId: string) {
  return useGraphQl({
    // language=GraphQL
    query: `
      query Data($id: ID!) {
        modpack(id: $id) {
          id
          minecraftVersion
          modLoader
          processingCount
          name
          mods {
            modId
            modVersion
            name
            supportedMinecraftVersions
            supportedModLoaders
            dependencies {
              modId
              versionRange
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
