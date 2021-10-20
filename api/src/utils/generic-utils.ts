import { nanoid } from 'nanoid';

export const generateId = nanoid;

export function lastItem<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}

export function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
