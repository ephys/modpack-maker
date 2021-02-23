import useSWR, { ConfigInterface as SwrConfig, responseInterface as SwrResponse } from 'swr';

type TGraphQLVariables = { [key: string]: any };

async function swrGraphQlFetch(query: string) {
  // TODO prod endpoint
  const response = await fetch('http://localhost:8080/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: query,
  });

  const body = await response.json();

  if (body.error) {
    throw new Error('GraphQL Error (improve this output in graphql.ts)');
  }

  return body.data;
}

export function callMutation(args: {
  query: string,
  variables: TGraphQLVariables,
}) {
  return swrGraphQlFetch(JSON.stringify(args));
}

export function useGraphQl<Data, Error>(args: {
  query: string,
  variables?: TGraphQLVariables,
  options?: SwrConfig<Data, Error>
}): SwrResponse<Data, Error> {
  const { query, variables, options } = args;

  return useSWR(JSON.stringify({ query, variables }), swrGraphQlFetch, options);
}
