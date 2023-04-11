export type TMinecraftVersion = {
  major: number,
  minor: number,
};

const versionCache = new Map();

export function serializeMinecraftVersion(minecraftVersion: TMinecraftVersion) {
  return `1.${minecraftVersion.major}.${minecraftVersion.minor}`;
}

const minecraftVersionRegex = /^1\.(?<major>[0-9]+)(?:\.(?<minor>[0-9]+))?$/;

export function parseMinecraftVersion(minecraftVersion: string): TMinecraftVersion | null {
  if (versionCache.has(minecraftVersion)) {
    return versionCache.get(minecraftVersion);
  }

  //   v major
  // 1.16.1 <- minor
  // ^ discarded
  const parts = minecraftVersion.match(minecraftVersionRegex);

  const majorStr = parts?.groups?.major;
  const minorStr = parts?.groups?.minor;

  if (!majorStr) {
    return null;
  }

  const major = Number(majorStr);
  const data = Object.freeze({
    major: major,
    minor: minorStr ? Number(minorStr) : 0
  });

  versionCache.set(minecraftVersion, data);

  return data;
}

export function isMcVersionLikelyCompatibleWith(compatibleWith: string, checkedItem: string): boolean {
  const source = parseMinecraftVersionThrows(compatibleWith);
  const checked = parseMinecraftVersionThrows(checkedItem);

  if (source.major != checked.major) {
    return false;
  }

  // source = modpack's mc version, checked = mod
  // modpack's mc version must be >= mod's mc version
  if (source.minor < checked.minor) {
    return false;
  }

  return true;
}

export function parseMinecraftVersionThrows(item: string): TMinecraftVersion {
  const val = parseMinecraftVersion(item);

  if (val == null) {
    throw new Error(`Invalid minecraft version ${item}`);
  }

  return val;
}

export function getFirstSemverMajorVersion(versionStr: string): string {
  const version = parseMinecraftVersionThrows(versionStr);

  return serializeMinecraftVersion({
    ...version,
    minor: 0,
  });
}

export function getMostCompatibleMcVersion(requestedStr: string, availableStr: string[]): string {
  const requested = parseMinecraftVersionThrows(requestedStr);

  sqlSort(availableStr, [
    [item => parseMinecraftVersionThrows(item).major === requested.major, 'DESC'],
    [item => parseMinecraftVersionThrows(item).major < requested.major, 'DESC'],
    [item => parseMinecraftVersionThrows(item).minor === requested.minor, 'DESC'],
    [item => parseMinecraftVersionThrows(item).minor < requested.minor, 'DESC'],
    [item => parseMinecraftVersionThrows(item).major, 'DESC'],
    [item => parseMinecraftVersionThrows(item).minor, 'DESC'],
  ]);

  return availableStr[0];
}

function sqlSort<T>(array: T[], orders): T[] {
  return array.sort((a, b) => {
    for (const [order, direction] of orders) {
      const aValue = typeof order === 'function' ? order(a) : a[order];
      const bValue = typeof order === 'function' ? order(b) : b[order];

      const result = comparePrimitives(aValue, bValue);

      if (result !== 0) {
        return direction === 'DESC' ? -result : result;
      }
    }

    return 0;
  });
}

function comparePrimitives(a, b): number {
  const type = typeof a;
  if (type !== typeof b) {
    throw new Error('a & b do not have the same type');
  }

  if (type === 'string') {
    return a.localeCompare(b);
  }

  if (type === 'number' || type === 'bigint') {
    return a - b;
  }

  if (type === 'boolean') {
    if (a === b) {
      return 0;
    }

    if (a) {
      return 1;
    }

    if (b) {
      return -1;
    }
  }

  throw new Error('Unsupported type ' + type);
}
