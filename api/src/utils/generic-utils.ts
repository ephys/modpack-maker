import { nanoid } from 'nanoid';

export const generateId = nanoid;
export const EMPTY_ARRAY: readonly any[] = Object.freeze([]);

export function lastItem<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}

export function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Returns whether array1 & array2 have at least one item in common
 */
export function overlaps<T>(array1: T[], array2: T[]): boolean {
  for (const item of array1) {
    if (array2.includes(item)) {
      return true;
    }
  }

  return false;
}
