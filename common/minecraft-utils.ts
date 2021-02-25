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
