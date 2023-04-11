import { parseMinecraftVersionThrows } from '@ephys/modpack-maker-common/minecraft-utils.js';
import minecraftVersion from '@ephys/modpack-maker-common/minecraft-versions.json';
import semver from 'semver';

export function minecraftVersionComparator(order: 'DESC' | 'ASC') {
  return (aStr, bStr) => {
    if (order === 'ASC') {
      const tmp = aStr;
      aStr = bStr;
      bStr = tmp;
    }

    const a = parseMinecraftVersionThrows(aStr);
    const b = parseMinecraftVersionThrows(bStr);

    if (a.major !== b.major) {
      return b.major - a.major;
    }

    return b.minor - a.minor;
  };
}

export function getMinecraftVersionsInRange(range: string): string[] {
  const valid: string[] = [];

  for (const version of minecraftVersion) {
    const coercedVersion = semver.coerce(version);
    if (coercedVersion == null) {
      throw new Error(`Could not parse minecraft version: ${version}`);
    }

    if (semver.satisfies(coercedVersion, range)) {
      valid.push(version);
    }
  }

  valid.sort(minecraftVersionComparator('DESC'));

  return valid;
}

export function getPreferredMinecraftVersions(mainVersionStr: string, existingMcVersions: string[]) {
  const validMcVersions = [mainVersionStr];
  const mainVersion = parseMinecraftVersionThrows(mainVersionStr);

  for (const versionStr of existingMcVersions) {
    const version = parseMinecraftVersionThrows(versionStr);

    if (version.major === mainVersion.major && version.minor <= mainVersion.minor) {
      validMcVersions.push(versionStr);
    }
  }

  validMcVersions.sort(minecraftVersionComparator('DESC'));

  return validMcVersions;
}

export { parseMinecraftVersion } from '@ephys/modpack-maker-common/minecraft-utils.js';
