import * as Zip from 'jszip';
import * as Toml from '@iarna/toml';
import { ModLoader } from '../../common/modloaders';

export type TModMeta = {
  name: string,
  modId: string,
  version: string,
  loader: ModLoader,
  mcVersion: string,
  // TODO: dependencies
};

export async function getModMetaFromJar(modJar: Buffer): Promise<Partial<TModMeta>> {
  const data = await Zip.loadAsync(modJar);
  let modMeta = {};

  // TODO support fabric.mod.json

  if (data.files['mcmod.info']) {
    // console.log(await data.file('mcmod.info').async('string'))
    const newMeta = getMetaFromLegacyMcModInfo(await data.file('mcmod.info').async('string'));

    Object.assign(modMeta, newMeta);

    if (isMetaComplete(modMeta)) {
      return modMeta;
    }
  }

  if (data.files['META-INF/mods.toml']) {
    // console.log();
    // console.log('META-INF/mods.toml');
    // console.log();
    // console.log(await data.file('META-INF/mods.toml').async('string'));
    // console.log();

    const newMeta = getMetaFromModsToml(await data.file('META-INF/mods.toml').async('string'));
    Object.assign(modMeta, newMeta);

    if (isMetaComplete(modMeta)) {
      return modMeta;
    }
  }

  if (data.files['META-INF/MANIFEST.MF']) {
    // console.log();
    // console.log('META-INF/MANIFEST.MF');
    // console.log();
    // console.log(await data.file('META-INF/MANIFEST.MF').async('string'));
    // console.log();

    const newMeta = getMetaFromJarManifest(await data.file('META-INF/MANIFEST.MF').async('string'));
    Object.assign(modMeta, newMeta);

    if (isMetaComplete(modMeta)) {
      return modMeta;
    }
  }

  return modMeta;
}

function isMetaComplete(t: Partial<TModMeta>): t is TModMeta {
  return t.loader != null && t.name != null && t.version != null;
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
    throw new Error('Found a mods.toml with more than one mod declaration. What do we do?');
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

  const meta: Partial<TModMeta> = omitFalsy({
    version,
    // @ts-ignore
    name: firstMod.displayName || null,
    // @ts-ignore
    modId: firstMod.modId || null,
    // only forge uses TOML
    // @ts-ignore
    loader: manifest.modLoader === 'javafml' ? ModLoader.FORGE : null,
  });

  return meta;
}

export function getMetaFromLegacyMcModInfo(fileContents): Partial<TModMeta> {
  const mcModInfo = JSON.parse(fileContents);

  if (!Array.isArray(mcModInfo)) {
    return null;
  }

  if (mcModInfo.length !== 1) {
    throw new Error('Found a mods.toml with more than one mod declaration. What do we do?');
  }
  // TODO: what if there is more than one mod in the package? should compare with modId from somewhere

  return omitFalsy({
    loader: ModLoader.FORGE,
    name: mcModInfo[0].name,
    modId: mcModInfo[0].modid,
    version: mcModInfo[0].version,
    mcVersion: mcModInfo[0].mcVersion,

  })
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
