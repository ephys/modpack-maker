import 'core-js/features/string/replace-all';
import * as Zip from 'jszip';
import * as Toml from '@iarna/toml';
import { ModLoader } from '../../../common/modloaders';
import { mavenVersionRangeToSemver } from './version-range';
import { TModDependency } from '../mod/mod-version.entity';
import { assertIsString } from '../../../common/typing-utils';
import { DependencyType } from '../../../common/dependency-type';

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

  const hasLegacyForge = data.files['mcmod.info'];
  const hasNewForge = data.files['META-INF/mods.toml'];

  // safeguard
  if (hasLegacyForge && hasNewForge) {
    throw new Error('Found a Jar declaring both a legacy forge mod & a new forge mod.');
  }

  const mods: Array<Partial<TModMeta>> = [];

  // FABRIC MOD
  if (data.files['fabric.mod.json']) {
    // fabric can only contain one mod
    mods.push(getMetaFromFabricManifest(await data.file('fabric.mod.json').async('string')));
  }

  // LEGACY FORGE MOD
  if (data.files['mcmod.info']) {
    mods.push(...getMetaFromLegacyMcModInfo(await data.file('mcmod.info').async('string')));
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
  const manifest = JSON.parse(fileContents);

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

      dependencies.push(dep)
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

// https://github.com/limulus/jarfile/blob/master/src/Jar.js
function parseJarManifest(manifest) {
  var result = { 'main': {}, 'sections': {} };

  var expectingSectionStart = false
    , skip = 0
    , currentSection = null;

  manifest = manifest.toString('utf8');
  var lines = manifest.split(/(?:\r\n|\r|\n)/);
  lines.forEach(function (line, i) {
    var entry;
    // this line may have already been processed, if so skip it
    if (skip) {
      skip--;
      return;
    }

    // Watch for blank lines, they mean we're starting a new section
    if (line === '') {
      expectingSectionStart = true;
      return;
    }

    // Extract the name and value from entry line
    var pair = line.match(/^([a-z0-9_-]+): (.*)$/i);
    if (!pair) {
      throwManifestParseError('expected a valid entry', i, line);
    }
    var name = pair[1], val = (pair[2] || '');

    // Handle section start
    if (expectingSectionStart && name !== 'Name') {
      throwManifestParseError('expected section name', i, line);
    } else if (expectingSectionStart) {
      currentSection = val;
      expectingSectionStart = false;
      return;
    }

    // Add entry to the appropriate section
    if (currentSection) {
      if (!result['sections'][currentSection]) {
        result['sections'][currentSection] = {};
      }
      entry = result['sections'][currentSection];
    } else {
      entry = result['main'];
    }
    entry[name] = val;
    for (var j = i + 1; j < lines.length; j++) {
      var byteLen = Buffer.byteLength(line, 'utf8');
      if (byteLen >= 70) {
        line = lines[j];
        if (line && line[0] === ' ') {
          // continuation lines must start with a space
          entry[name] += line.substr(1);
          skip++;
          continue;
        }
      }
      break;
    }
  });

  return result;
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
        minecraftVersionRange = mavenVersionRangeToSemver(manifestDep.versionRange);
        continue;
      }

      const dep: TModDependency = {
        modId: manifestDep.modId,
        versionRange: mavenVersionRangeToSemver(manifestDep.versionRange),
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
  return JSON.parse(fileContents.replaceAll('\n', ''));
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

function throwManifestParseError(msg, lineNum, lineContent) {
  throw new Error(`Failed to parse manifest at line ${lineNum}: ${msg}\n\n${lineContent}`);
}

function omitFalsy(obj) {
  for (const key of Object.keys(obj)) {
    if (!obj[key]) {
      delete obj[key];
    }
  }

  return obj;
}
