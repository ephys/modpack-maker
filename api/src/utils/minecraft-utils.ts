import * as minecraftVersion from '../../../common/minecraft-versions.json';
import * as semver from 'semver';
import { parseMinecraftVersion } from '../../../common/minecraft-utils';

export { parseMinecraftVersion };

export function minecraftVersionComparator(order: 'DESC' | 'ASC') {
  return (aStr, bStr) => {
    if (order === 'ASC') {
      const tmp = aStr;
      aStr = bStr;
      bStr = tmp;
    }

    const a = parseMinecraftVersion(aStr);
    const b = parseMinecraftVersion(bStr);

    if (a.major !== b.major) {
      return b.major - a.major;
    }

    return b.minor - a.minor;
  };
}

export function getMinecraftVersionsInRange(range: string): string[] {
  const valid = [];

  for (const version of minecraftVersion) {
    if (semver.satisfies(semver.coerce(version), range)) {
      valid.push(version);
    }
  }

  valid.sort(minecraftVersionComparator('DESC'));

  return valid;
}
