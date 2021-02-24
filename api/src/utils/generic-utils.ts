import { nanoid } from 'nanoid';

export const generateId = nanoid;

export function lastItem<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}
