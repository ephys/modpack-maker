import { Transform } from 'class-transformer';

export function Trim() {
  return Transform(({ value }) => value?.trim());
}
