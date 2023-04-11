export function isPlainObject(val: unknown): val is Record<string | symbol | number, unknown> {
  if (val === null || typeof val !== 'object') {
    return false;
  }

  const proto = Object.getPrototypeOf(val);

  return proto === Object.prototype || proto === null;
}
