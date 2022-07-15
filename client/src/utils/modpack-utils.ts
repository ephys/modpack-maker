import memoizeOne from 'memoize-one';
import type { TModpackFragment } from '../api/graphql.generated.js';
import { useAddJarToModpackMutation, useRemoveJarFromModpackMutation } from '../api/graphql.generated.js';
import { useCurrentModpack } from '../components/current-modpack-provider.js';
import { useSnackbar } from '../components/snackbar.js';
import { useAsyncCallback } from './use-async-callback.js';

export function jarInModpack(modpack: TModpackFragment, jarId: string): boolean {
  return modpack.version!.installedJars.some(j => j.jar.id === jarId);
}

export function modsInModpack(modpack: TModpackFragment, modIds: string[]) {
  const installedModIds = getInstalledModIds(modpack);

  return modIds.every(modId => installedModIds.has(modId));
}

const getInstalledModIds = memoizeOne((modpack: TModpackFragment) => {
  const out = new Set();

  for (const installedJar of modpack.version!.installedJars) {
    for (const mod of installedJar.jar.mods) {
      out.add(mod.modId);
    }
  }

  return out;
});

export function useAddJarToModpack() {
  const addSnack = useSnackbar();
  const callAddJar = useAddJarToModpackMutation();
  const currentModpack = useCurrentModpack();
  const modpackId = currentModpack?.version?.id;

  return useAsyncCallback(async (jarId: string) => {
    await callAddJar({
      modpackVersion: modpackId!,
      jar: jarId,
    });

    // TODO: add action "close project"
    //  - if coming from search, return to search
    //  - if coming from modpack, return to modpack
    addSnack('Added to modpack', {
      type: 'success',
    });
  }, [modpackId]);
}

export function useRemoveJarFromModpack() {
  const addSnack = useSnackbar();
  const callRemoveJar = useRemoveJarFromModpackMutation();
  const currentModpack = useCurrentModpack();
  const modpackId = currentModpack?.version?.id;

  return useAsyncCallback(async (jarId: string) => {
    await callRemoveJar({
      modpackVersion: modpackId!,
      jar: jarId,
    });

    addSnack('Removed modpack', {
      type: 'success',
    });
  }, [modpackId]);
}
