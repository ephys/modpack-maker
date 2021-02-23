import { useRouter } from 'next/router';
import { useGraphQl } from '../../api/graphql';
import { isLoadedSwr } from '../../api/swr';
import DropZone, { getAsStringAsync } from '../../components/dropzone';
import { useCallback, useEffect } from 'react';
import css from './[id].module.scss';
import { addModpackMod } from '../../api/add-modpack-mod';
import { assertIsString } from '../../utils/typing';

export default function ModpackRoute() {
  const router = useRouter();
  const { id } = router.query;

  if (!id) {
    return null;
  }

  assertIsString(id);

  return (
    <ModpackView id={id} />
  )
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
    if (modpack.processingUrls) {
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

          <h2>Mod List</h2>
        </div>
      </DropZone>
    </>
  );
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
          processingUrls
          name
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
