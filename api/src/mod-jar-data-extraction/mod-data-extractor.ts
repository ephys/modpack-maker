import 'core-js/features/string/replace-all';
import * as Zip from 'jszip';
import * as Toml from '@iarna/toml';
import { ModLoader } from '../../../common/modloaders';
import { mavenVersionRangeToSemver } from './version-range';
import { TModDependency } from '../mod/mod-version.entity';
import { assertIsString } from '../../../common/typing-utils';
import { DependencyType } from '../../../common/dependency-type';
import { parseJarManifest } from './jar-manifestmf-parser';

export type TModMeta = {
  name: string,
  modId: string,
  version: string,
  loader: ModLoader,
  minecraftVersionRange: string | null,
  dependencies: Array<TModDependency>,
};

// FIXME: bow infinity fix uses "bifmod.info" :/

export async function getModMetasFromJar(modJar: Buffer): Promise<Array<Partial<TModMeta>>> {
  const data = await Zip.loadAsync(modJar);

  const hasNewForge = data.files['META-INF/mods.toml'];

  const mods: Array<Partial<TModMeta>> = [];

  // FABRIC MOD
  if (data.files['fabric.mod.json']) {
    // fabric can only contain one mod
    mods.push(getMetaFromFabricManifest(await data.file('fabric.mod.json').async('string')));
  }

  if (hasNewForge) {
    let modMeta = {};

    if (data.files['META-INF/mods.toml']) {
      const newMeta = getMetaFromModsToml(await data.file('META-INF/mods.toml').async('string'));
      mergeModMeta(modMeta, newMeta);
    }

    // NEW FORGE META
    if (!isMetaComplete(modMeta) && data.files['META-INF/MANIFEST.MF']) {
      const newMeta = getMetaFromJarManifest(await data.file('META-INF/MANIFEST.MF').async('string'));
      mergeModMeta(modMeta, newMeta);
    }

    mods.push(modMeta);
  } else if (data.files['mcmod.info']) {
    // LEGACY FORGE MOD
    mods.push(...getMetaFromLegacyMcModInfo(await data.file('mcmod.info').async('string')));
  }

  return mods;
}

function isMetaComplete(t: Partial<TModMeta>): t is TModMeta {
  return t.loader != null && t.name != null && t.version != null;
}

function mergeModMeta(main: Partial<TModMeta>, toAdd: Partial<TModMeta>): Partial<TModMeta> {
  for (const key of Object.keys(toAdd)) {
    if (key === 'modId' && toAdd[key] === 'examplemod') {
      continue;
    }

    if (main[key]) {
      continue;
    }

    main[key] = toAdd[key];
  }

  return main;
}

/*
  // https://fabricmc.net/wiki/documentation:fabric_mod_json
  Useful fields from fabric.mod.json:
  "description": "Adds shelves to showcase your items",
  "contact": {
    "homepage": "https://www.curseforge.com/minecraft/mc-mods/shelf",
    "issues": "https://www.curseforge.com/minecraft/mc-mods/shelf/issues"
  },
  "license": "CC0-1.0",
  "icon": "shelf_icon.png",
  "environment": "*" / "client" / "server"
 */
function getMetaFromFabricManifest(fileContents): Partial<TModMeta> {
  const manifest = permissivelyParseJson(fileContents);

  const dependencyTypes: DependencyType[] = Object.values(DependencyType);
  const dependencies: Array<TModDependency> = [];
  let minecraftVersionRange;

  const seen = new Set();
  for (const type of dependencyTypes) {
    const manifestDeps = manifest[type];
    if (!manifestDeps) {
      continue;
    }

    for (const [modId, version] of Object.entries(manifestDeps)) {
      if (seen.has(modId)) {
        throw new Error(`Mod ${manifest.id} declares dependency ${modId} twice`);
      }

      seen.add(modId);

      if (modId === 'minecraft') {
        minecraftVersionRange = version;
        continue;
      }

      const dep: TModDependency = {
        modId,
        type,
      };

      assertIsString(version);

      if (version !== '*') {
        dep.versionRange = version;
      }

      dependencies.push(dep);
    }
  }

  dependencies.sort((a, b) => a.modId.localeCompare(b.modId));

  return omitFalsy({
    modId: manifest.id,
    version: manifest.version,
    name: manifest.name,
    loader: ModLoader.FABRIC,
    dependencies,
    minecraftVersionRange,
  });
}

export function getMetaFromJarManifest(fileContents): Partial<TModMeta> {
  const manifest = parseJarManifest(fileContents);

  if (!manifest || !manifest.main) {
    return null;
  }

  return omitFalsy({
    version: manifest.main['Implementation-Version'],
    modId: manifest.main['Specification-Title'],
  });
}

/*
Useful fields from toml:
issueTrackerURL
license
mods.x.displayURL
mods.x.description
mods.x.logoFile
 */
export function getMetaFromModsToml(fileContents): Partial<TModMeta> {
  const manifest = Toml.parse(fileContents);

  if (!manifest || !Array.isArray(manifest.mods)) {
    return null;
  }

  // TODO: what if there is more than one mod in the package?
  if (manifest.mods.length !== 1) {
    throw new Error('Found a mods.toml mod with more than one mod declaration. What do we do?');
  }

  const firstMod = manifest.mods[0];

  // @ts-ignore
  let version = firstMod.version;

  // starting with ${ means there was some attempt at substituting a var but it failed
  // eg. version="${file.jarVersion}"
  // we'll fallback to the next possible source of version
  if (typeof version !== 'string' || version.startsWith('${')) {
    version = null;
  }

  // @ts-ignore
  const modId = firstMod.modId;

  const dependencies: TModDependency[] = [];
  let minecraftVersionRange;

  if (modId && manifest.dependencies?.[modId]) {
    const manifestDependencies = manifest.dependencies[modId];
    for (const manifestDep of manifestDependencies) {
      if (manifestDep.modId.toLowerCase() === 'minecraft') {
        if (manifestDep.versionRange) {
          minecraftVersionRange = mavenVersionRangeToSemver(manifestDep.versionRange);
        }

        continue;
      }

      const dep: TModDependency = {
        modId: manifestDep.modId,
        versionRange: manifestDep.versionRange ? mavenVersionRangeToSemver(manifestDep.versionRange) : undefined,
        type: manifestDep.mandatory ? DependencyType.depends : DependencyType.suggests,
      };

      dependencies.push(dep);
    }
  }

  dependencies.sort((a, b) => a.modId.localeCompare(b.modId));

  const meta: Partial<TModMeta> = omitFalsy({
    version,
    // @ts-ignore
    name: firstMod.displayName || null,
    modId: modId || null,
    // only forge uses TOML
    // @ts-ignore
    loader: manifest.modLoader === 'javafml' ? ModLoader.FORGE : null,
    dependencies,
    minecraftVersionRange,
  });

  return meta;
}

function permissivelyParseJson(fileContents) {
  // some users put line-breaks inside their JSON string which is invalid (should have used '\n' instead)
  return JSON.parse(fileContents.replaceAll('\n', ' '));
}

export function getMetaFromLegacyMcModInfo(fileContents): Array<Partial<TModMeta>> {
  const mcModInfo = permissivelyParseJson(fileContents);

  if (!Array.isArray(mcModInfo)) {
    throw new Error('Invalid mcmod.info file');
  }

  return mcModInfo.map(mod => {
    if (mod.modId === 'examplemod') {
      throw new Error('Found a mod called examplemod (mcmod.info)');
    }

    // TODO: deps + mc + forge version

    return {
      loader: ModLoader.FORGE,
      name: mod.name,
      modId: mod.modid,
      version: mod.version,
      minecraftVersionRange: mod.mcversion,
    };
  });
}

function omitFalsy(obj) {
  for (const key of Object.keys(obj)) {
    if (!obj[key]) {
      delete obj[key];
    }
  }

  return obj;
}
