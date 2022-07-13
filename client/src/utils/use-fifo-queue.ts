import { useState, useCallback } from 'react';

export function useFifoQueue<T>(): [items: T[], push: (val: T) => void, next: () => T | undefined] {
  const [items, setItems] = useState<T[]>([]);

  const push = useCallback((snack: T) => {
    setItems(oldSnacks => [...oldSnacks, snack]);
  }, []);

  const next = useCallback(() => {
    let item: T | undefined;
    setItems(oldSnacks => {
      const newSnacks = [...oldSnacks];
      item = newSnacks.shift();

      return newSnacks;
    });

    return item;
  }, []);

  return [items, push, next];
}
