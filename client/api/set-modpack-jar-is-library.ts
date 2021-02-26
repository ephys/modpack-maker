import { callMutation } from './graphql';
import { TModpack } from './schema-typings';

type TSetModpackJarIsLibraryInput = {
  isLibrary: boolean,
  jarId: string,
  modpackId: string,
};

export async function setModpackJarIsLibrary(input: TSetModpackJarIsLibraryInput): Promise<TModpack> {
  const response = await callMutation({
    // language=GraphQL
    query: `
      mutation Mutation($input: SetModpackJarIsLibraryInput!) {
        setModpackJarIsLibrary(input: $input) {
          node {
            isLibraryDependency
          }
        }
      }
    `,
    variables: { input },
  });

  return response.setModpackJarIsLibrary.node;
}
