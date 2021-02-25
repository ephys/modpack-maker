import 'core-js/features/string/replace-all';
import * as Zip from 'jszip';
import * as Toml from '@iarna/toml';
import { ModLoader } from '../../../common/modloaders';
import { mavenVersionRangeToSemver } from './version-range';
import { TModDependency } from '../mod/mod-version.entity';

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

  const hasFabric = data.files['fabric.mod.json'];
  const hasLegacyForge = data.files['mcmod.info'];
  const hasNewForge = data.files['META-INF/mods.toml'];

  // safeguard
  if (hasLegacyForge && hasNewForge) {
    throw new Error('Found a Jar declaring both a legacy forge mod & a new forge mod.');
  }

  // safeguard, but this might be allowed.
  if (hasFabric && (hasLegacyForge || hasNewForge)) {
    throw new Error('Found a Jar declaring both forge & fabric.');
  }

  // FABRIC MOD
  if (data.files['fabric.mod.json']) {
    // fabric can only contain one mod
    return [
      getMetaFromFabricManifest(await data.file('fabric.mod.json').async('string'))
    ];
  }

  // LEGACY FORGE MOD
  if (data.files['mcmod.info']) {
    return getMetaFromLegacyMcModInfo(await data.file('mcmod.info').async('string'));
  }

  let modMeta = {};

  // NEW FORGE MOD
  if (data.files['META-INF/mods.toml']) {
    const newMeta = getMetaFromModsToml(await data.file('META-INF/mods.toml').async('string'));
    mergeModMeta(modMeta, newMeta);

    if (isMetaComplete(modMeta)) {
      return [modMeta];
    }
  }

  // NEW FORGE META
  if (data.files['META-INF/MANIFEST.MF']) {
    const newMeta = getMetaFromJarManifest(await data.file('META-INF/MANIFEST.MF').async('string'));
    mergeModMeta(modMeta, newMeta);

    if (isMetaComplete(modMeta)) {
      return [modMeta];
    }
  }

  return [modMeta];
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

function getMetaFromFabricManifest(fileContents): Partial<TModMeta> {
  const manifest = JSON.parse(fileContents);

  // TODO: deps + mc + fabric loader

  /* TODO:
    "depends": {
    "fabricloader": "\u003e\u003d0.8.9",
    "fabric": "*",
    "minecraft": "1.16.x"
  },
  TODO:
  "suggests": {
    "modmenu": "1.14.5+build.30"
  },
   */

  return omitFalsy({
    modId: manifest.id,
    version: manifest.version,
    name: manifest.name,
    loader: ModLoader.FABRIC,
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
    for (const dep of manifestDependencies) {
      if (dep.modId.toLowerCase() === 'minecraft') {
        minecraftVersionRange = mavenVersionRangeToSemver(dep.versionRange);
        continue;
      }

      dependencies.push({
        modId: dep.modId,
        versionRange: mavenVersionRangeToSemver(dep.versionRange),
      });
    }
  }

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
