import { callMutation } from './graphql';

type TCreateModpackInput = {
  name: string,
  modLoader: string,
  minecraftVersion: string,
};

export type TModpack = {
  id: string,
}

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
