import { ModLoader } from '../../common/modloaders';
import { DependencyType } from '../../common/dependency-type';
import { ReleaseType } from '../../api/src/mod/mod-jar.entity';

export type TModpack = {
  id: string,
  minecraftVersion: string,
  modLoader: ModLoader,
  processingCount: number,
  name: string,
  downloadUrl: string,
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
  curseForgePage: string,
  fileName: string,
  releaseType: ReleaseType,
  mods: TModVersion[],
};

export type TModVersion = {
  modId: string,
  modVersion: string,
  name: string,
  supportedMinecraftVersions: string[],
  supportedModLoader: ModLoader,
  updatedVersion: TModJar | null,
  dependencies: Array<{
    modId: string,
    versionRange: string,
    type: DependencyType,
  }>,
};
