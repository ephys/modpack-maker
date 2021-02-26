import { callMutation } from './graphql';
import { TModpack } from './schema-typings';

type TAddModpackModInput = {
  byUrl: string[],
  modpackId: string,
};

export async function addModToModpack(input: TAddModpackModInput): Promise<TModpack> {
  const response = await callMutation({
    // language=GraphQL
    query: `
      mutation Mutation($input: AddModpackModInput!) {
        addModToModpack(input: $input) {
          node {
            id
          }
        }
      }
    `,
    variables: { input },
  });

  return response.addModToModpack.node;
}
