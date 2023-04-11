import type { RefObject } from 'react';
import { useCallback } from 'react';

export function useResetScroll(ref: RefObject<HTMLElement>) {
  return useCallback(() => {
    ref.current?.scrollTo({
      top: 0,
    });
  }, []);
}
