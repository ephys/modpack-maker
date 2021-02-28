import { callMutation } from './graphql';
import { TModpack } from './schema-typings';

type TReplaceModpackJarInput = {
  modpackId: string;
  oldJarId: string;
  newJarId: string;
};

export async function replaceModpackJar(input: TReplaceModpackJarInput): Promise<TModpack> {
  const response = await callMutation({
    // language=GraphQL
    query: `
      mutation Mutation($input: ReplaceModpackJarInput!) {
        replaceModpackJar(input: $input) {
          node {
            id
          }
        }
      }
    `,
    variables: { input },
  });

  return response.replaceModpackJar.node;
}
