export function assertIsString(item: any): asserts item is string {
  if (typeof item !== 'string') {
    throw new Error('expected input to be string, got ' + typeof item);
  }
}

export type MaybePromise<T> = Promise<T> | T;
