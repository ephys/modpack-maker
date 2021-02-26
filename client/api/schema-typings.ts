import { ModLoader } from '../../common/modloaders';

export type TModpack = {
  id: string,
  minecraftVersion: string,
  modLoader: ModLoader,
  processingCount: number,
  name: string,
  modJars: TModpackMod[],
};

export type TModpackMod = {
  addedAt: string,
  isLibraryDependency: boolean,
  jar: TModJar,
};

export type TModJar = {
  id: string,
  downloadUrl: string,
  fileName: string,
  releaseType: string,
  mods: TModVersion[],
};

export type TModVersion = {
  modId: string,
  modVersion: string,
  name: string,
  supportedMinecraftVersions: string[],
  supportedModLoader: ModLoader,
  dependencies: Array<{
    modId: string,
    versionRange: string,
  }>
};
