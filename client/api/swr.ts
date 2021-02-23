import useSWR, { responseInterface as SwrResponse } from 'swr';

export function isLoadedSwr<T = any, Error = any>(swr: SwrResponse<T, Error>) {
  if (!swr) {
    return false;
  }

  return swr.data !== undefined || swr.error !== undefined;
}
