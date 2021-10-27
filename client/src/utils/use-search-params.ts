import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export function useSearchParams() {
  const location = useLocation();

  return useMemo(() => {
    return new URLSearchParams(location.search);
  }, [location.search]);
}

export function modifySearch(search: URLSearchParams, newData: { [key: string]: string | number }): URLSearchParams {
  search = new URLSearchParams(search);

  for (const key of Object.keys(newData)) {
    search.set(key, String(newData[key]));
  }

  return search;
}
