export function assert(val: boolean, msg?: string): asserts val {
  if (!val) {
    throw new Error(msg || 'assertion failed');
  }
}
