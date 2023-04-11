import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { TModpackFragment } from '../api/graphql.generated.js';

const CurrentModpackContext = createContext<TModpackFragment | null>(null);

export function CurrentModpackProvider(props: { children: ReactNode, modpack?: TModpackFragment }) {
  return (
    <CurrentModpackContext.Provider value={props.modpack ?? null}>
      {props.children}
    </CurrentModpackContext.Provider>
  );
}

export function useCurrentModpack() {
  return useContext(CurrentModpackContext);
}
