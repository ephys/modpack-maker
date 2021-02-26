export type TMinecraftVersion = {
  major: number,
  minor: number,
};

const versionCache = new Map();

export function parseMinecraftVersion(minecraftVersion: string): TMinecraftVersion {
  if (versionCache.has(minecraftVersion)) {
    return versionCache.get(minecraftVersion);
  }

  //   v major
  // 1.16.1 <- minor
  // ^ discarded
  const parts = minecraftVersion.split('.');

  const data = Object.freeze({
    major: Number(parts[1]),
    minor: parts[2] ? Number(parts[2]) : 0
  });

  versionCache.set(minecraftVersion, data);

  return data;
}

export function isMcVersionLikelyCompatibleWith(compatibleWith: string, checkedItem: string): boolean {
  const source = parseMinecraftVersion(compatibleWith);
  const checked = parseMinecraftVersion(checkedItem);

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

export function getMostCompatibleMcVersion(requestedStr: string, availableStr: string[]): string {
  const requested = parseMinecraftVersion(requestedStr);

  sqlSort(availableStr, [
    [item => parseMinecraftVersion(item).major === requested.major, 'DESC'],
    [item => parseMinecraftVersion(item).major < requested.major, 'DESC'],
    [item => parseMinecraftVersion(item).minor === requested.minor, 'DESC'],
    [item => parseMinecraftVersion(item).minor < requested.minor, 'DESC'],
    [item => parseMinecraftVersion(item).major, 'DESC'],
    [item => parseMinecraftVersion(item).minor, 'DESC'],
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
