import { isString } from '@ephys/fox-forge';
import { ModLoader } from '@ephys/modpack-maker-common/modloaders.js';
import Toml from '@iarna/toml';
import Zip from 'jszip';
import { DependencyType } from '../mod/dependency-type.js';
import type { TModDependency } from '../mod/mod-version.entity.js';
import { parseJarManifest } from './jar-manifestmf-parser.js';
import { mavenVersionRangeToSemver } from './version-range.js';

export type TModMeta = {
  name: string,
  modId: string,
  version: string,
  loader: ModLoader,
  minecraftVersionRange: string | null,
  dependencies: TModDependency[],
};

// FIXME: bow infinity fix uses "bifmod.info" :/

export async function getModMetasFromJar(modJar: Buffer): Promise<TModMeta[]> {
  const data = await Zip.loadAsync(modJar);

  const hasNewForge = data.files['META-INF/mods.toml'];

  const mods: Array<Partial<TModMeta>> = [];

  // FABRIC MOD
  if (data.files['fabric.mod.json']) {
    // fabric can only contain one mod
    mods.push(getMetaFromFabricManifest(await data.file('fabric.mod.json')!.async('string')));
  }

  if (hasNewForge) {
    const modMetas: Array<Partial<TModMeta>> = [];

    if (data.files['META-INF/mods.toml']) {
      const newMetas = getMetaFromModsToml(await data.file('META-INF/mods.toml')!.async('string'));
      modMetas.push(...newMetas);
    }

    // NEW FORGE META
    if (data.files['META-INF/MANIFEST.MF']) {
      const versionFromManifest = getVersionFromJarManifest(await data.file('META-INF/MANIFEST.MF')!.async('string'));
      if (versionFromManifest) {
        for (const modMeta of modMetas) {
          // eslint-disable-next-line max-depth
          if (!modMeta.version) {
            modMeta.version = versionFromManifest;
          }
        }
      }
    }

    mods.push(...modMetas);
  } else if (data.files['mcmod.info']) {
    // LEGACY FORGE MOD
    mods.push(...getMetaFromLegacyMcModInfo(await data.file('mcmod.info')!.async('string')));
  }

  const completeMods: TModMeta[] = [];
  for (const mod of mods) {
    if (!isMetaComplete(mod)) {
      console.error('found incomplete mod data');
      console.error(mod);
      continue;
    }

    completeMods.push(mod);
  }

  return completeMods;
}

function isMetaComplete(t: Partial<TModMeta>): t is TModMeta {
  return t.loader != null && t.name != null && t.version != null && t.modId != null;
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
  const dependencies: TModDependency[] = [];
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

      isString.assert(version);

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

export function getVersionFromJarManifest(fileContents: string): string | null {
  const manifest = parseJarManifest(fileContents);

  if (!manifest || !manifest.main) {
    return null;
  }

  return manifest.main['Implementation-Version'] || null;
}

/*
Useful fields from toml:
issueTrackerURL
license
mods.x.displayURL
mods.x.description
mods.x.logoFile
 */
export function getMetaFromModsToml(fileContents): Array<Partial<TModMeta>> {
  const manifest = Toml.parse(fileContents);

  if (!manifest || !Array.isArray(manifest.mods)) {
    return [];
  }

  return manifest.mods.map(manifestMod => {
    let version = manifestMod.version;

    // starting with ${ means there was some attempt at substituting a var but it failed
    // eg. version="${file.jarVersion}"
    // we'll fallback to the next possible source of version
    if (typeof version !== 'string' || version.startsWith('${')) {
      version = null;
    }

    const modId = manifestMod.modId;

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

    const isForge = manifest.modLoader === 'javafml' || manifest.modLoader === 'scorge' || dependencies.find(dep => dep.modId === 'forge');

    const meta: Partial<TModMeta> = omitFalsy({
      version,
      name: manifestMod.displayName || null,
      modId: modId || null,
      // only forge uses TOML
      loader: isForge ? ModLoader.FORGE : null,
      dependencies,
      minecraftVersionRange,
    });

    return meta;
  });
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
