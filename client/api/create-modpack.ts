import { callMutation } from './graphql';
import { TModpack } from './schema-typings';

type TCreateModpackInput = {
  name: string,
  modLoader: string,
  minecraftVersion: string,
};

export async function createModpack(input: TCreateModpackInput): Promise<TModpack> {
  const response = await callMutation({
    query: `
      mutation CreateModpack($input: CreateModpackInput!) {
    createModpack(input: $input) {
      node {
        id
      }
    }
  }
  `,
    variables: { input },
  });

  return response.createModpack.node;
}
