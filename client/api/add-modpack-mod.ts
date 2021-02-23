import { callMutation } from './graphql';

type TAddModpackModInput = {
  byUrl: string[],
  modpackId: string,
};

export type TModpack = {
  id: string,
}

export async function addModpackMod(input: TAddModpackModInput): Promise<TModpack> {
  const response = await callMutation({
    // language=GraphQL
    query: `
      mutation Mutation($input: AddModpackModInput!) {
        addModpackMod(input: $input) {
          node {
            id
          }
        }
      }
    `,
    variables: { input },
  });

  return response.addModpackMod.node;
}
