import { callMutation } from './graphql';
import { TModpack } from './schema-typings';

type TRemoveJarFromModpackInput = {
  jarId: string,
  modpackId: string,
};

export async function removeJarFromModpack(input: TRemoveJarFromModpackInput): Promise<TModpack> {
  const response = await callMutation({
    // language=GraphQL
    query: `
      mutation Mutation($input: RemoveJarFromModpackInput!) {
        removeJarFromModpack(input: $input) {
          node {
            id
          }
        }
      }
    `,
    variables: { input },
  });

  return response.removeJarFromModpack.node;
}
