export function parseSafeIntegerOrThrow(value: string): number {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Value ${value} is not a safe integer`);
  }

  return parsed;
}
