import type { NonUndefined } from '@ephys/fox-forge';
import { assert } from '@ephys/modpack-maker-common';
import { devtoolsExchange } from '@urql/devtools';
import type { Cache } from '@urql/exchange-graphcache';
import { cacheExchange } from '@urql/exchange-graphcache';
import { makeDefaultStorage } from '@urql/exchange-graphcache/default-storage';
import type { DocumentNode } from 'graphql';
import { useCallback, useMemo } from 'react';
import type { OperationContext, UseQueryArgs, UseQueryState } from 'urql';
import { createClient, dedupExchange, fetchExchange, useMutation as useUrqlMutation, useQuery as useUrqlQuery } from 'urql';
import type {
  TAddJarToModpackMutation,
  TAddJarToModpackMutationVariables,
  TRemoveJarFromModpackMutation,
  TRemoveJarFromModpackMutationVariables,
  TReplaceModpackJarMutation,
  TReplaceModpackJarMutationVariables,
} from './graphql.generated';

export const urqlClient = createClient({
  url: `${location.protocol}//${location.hostname}:8080/graphql`,
  requestPolicy: 'cache-and-network',
  // fetchOptions: () => {
  // TODO
  // const token = getAuthToken();
  //
  // return {
  //   headers: { authorization: token ?? '' },
  // };
  // },
  exchanges: [
    ...(process.env.NODE_ENV === 'production' ? [] : [devtoolsExchange]),
    dedupExchange,
    cacheExchange({
      keys: {
        GqlModDependency: () => null,
        ModpackMod: () => null,
      },
      // storage: makeDefaultStorage({ idbName: 'modpack-urql' }),
      updates: {
        Mutation: {
          replaceModpackJar(
            result: TReplaceModpackJarMutation,
            args: TReplaceModpackJarMutationVariables,
            cache: Cache,
          ) {
            cache.invalidate({
              __typename: 'ModpackVersion',
              id: args.input.modpackVersion,
            }, 'installedJars');
          },
          removeJarFromModpack(
            result: TRemoveJarFromModpackMutation,
            args: TRemoveJarFromModpackMutationVariables,
            cache: Cache,
          ) {
            cache.invalidate({
              __typename: 'ModpackVersion',
              id: args.input.modpackVersion,
            }, 'installedJars');
          },
          addJarToModpack(result: TAddJarToModpackMutation, args: TAddJarToModpackMutationVariables, cache: Cache) {
            cache.invalidate({
              __typename: 'ModpackVersion',
              id: args.input.modpackVersion,
            }, 'installedJars');
          },
          // setModpackJarIsLibrary
        },
      },
    }),
    fetchExchange,
  ],
});

export type TRevalidate = (opts?: Partial<OperationContext>) => void;
export type TUseQueryOutput<Data, Variables> = UseQueryState<Data, Variables> & { revalidate: TRevalidate };

export function useQuery<Data = any, Vars = object>(args: UseQueryArgs<Vars, Data>): TUseQueryOutput<Data, Vars> {
  const [res, revalidate] = useUrqlQuery(args);

  // @ts-expect-error
  return useMemo(() => {
    // @ts-expect-error
    res.revalidate = revalidate;

    return res;
  }, [res, revalidate]);
}

type TMutationVariables = {
  input: object,
};

export type TCallMutation<Variables, Payload> = (
  variables: Variables,
  context?: Partial<OperationContext>,
) => Promise<Payload>;

export type TMutationResponse = {
  __typename: 'Mutation',
  [key: string]: TGenericPayload | 'Mutation',
};

export type TGenericPayload = {
  node?: any | null,
  error?: TGenericPayloadError | null,
};

export type TGenericPayloadError = { message?: string, code: string };

export type SuccessResponse<T extends TMutationResponse> = {
  [K in keyof T]: T[K] extends TGenericPayload ? SuccessPayload<T[K]> : T[K]
};

type SuccessPayload<T extends TGenericPayload> = {
  node: NonNullable<T['node']>,
  error: null,
};

/**
 * Throws an error if one of the payloads returned by the mutation has an error.
 *
 * @param queriedData the 'data' part of the graphql response
 * @returns {SuccessResponse<Response>} the same object, but TypeScript knows that the error field of payloads is null, and the node field is not null.
 */
export function processMutationData<Response extends TMutationResponse>(queriedData: Response): SuccessResponse<Response> {
  assert(queriedData != null);

  const payloadError = getPayloadError(queriedData);
  if (payloadError != null) {
    const error = new Error(`${payloadError.message ?? 'GraphQL request failure'} (${payloadError.code})`);
    // @ts-expect-error
    error.code = payloadError.code;

    throw error;
  }

  // @ts-expect-error
  return queriedData;
}

export function getPayloadError(queriedData: TMutationResponse): TGenericPayloadError | null {
  const keys = Object.keys(queriedData).filter(k => k !== '__typename');

  for (const key of keys) {
    const payload = queriedData[key];

    assert(payload !== 'Mutation');

    if (payload.error) {
      return payload.error;
    }
  }

  return null;
}

export function useMutation<
  Response extends TMutationResponse,
  Variables extends TMutationVariables,
  >(documentNode: DocumentNode): TCallMutation<Variables['input'], SuccessResponse<Response>> {
  const [, callMutation] = useUrqlMutation<Response, { input: Variables['input'] }>(documentNode);

  return useCallback(async (input: Variables['input'], context?: Partial<OperationContext>): Promise<SuccessResponse<Response>> => {
    const result = await callMutation({ input }, context);

    if (result.error) {
      throw result.error;
    }

    assert(result.data != null);

    return processMutationData(result.data);
  }, [callMutation]);
}

export function isLoadedUrql<Data, Error>(state: UseQueryState<Data, Error>): state is (
  Omit<UseQueryState<Data, Error>, 'data' | 'error'>
  & (
  { data: NonUndefined<UseQueryState<Data, Error>['data']>, error: undefined }
  | { data: undefined, error: NonNullable<UseQueryState<Data, Error>['error']> })
  ) {

  return state.data !== undefined || state.error != null;
}

export { type UseQueryArgs } from 'urql';
