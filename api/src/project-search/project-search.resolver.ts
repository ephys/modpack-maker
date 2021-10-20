import { Args, Query, Resolver } from '@nestjs/graphql';
import { ProjectConnection } from '../mod/project.resolver';
import { After, First, sequelizeCursorToConnection } from '../utils/graphql-connection-utils';
import { ProjectSearchService } from './project-search.service';

@Resolver()
class ProjectSearchResolver {
  constructor(
    private readonly projectSearchService: ProjectSearchService,
  ) {
  }

  @Query(() => ProjectConnection, {
    name: 'projects', description: `
**Returns project matching the search query.**  
Uses [lucene syntax](https://lucene.apache.org/core/2_9_4/queryparsersyntax.html)

### Supported fields (mods):

Mods fields combinations \`(modLoader AND minecraftVersion)\` are checked per-mod instead of per-project.
this means that if a Project has two jars, one that supports modLoader and one that supports minecraftVersion, but not
both at the same time, it will not be returned. A single jar needs to support both to be returned.

- **modId** - returns only projects that have at least one jar containing this modId
- **modName** - returns only projects that have at least one jar containing one mod that matches modName
- **minecraftVersion** - returns only projects that have at least one jar containing one mod that supports minecraftVersion
- **modLoader** - returns only projects that have at least one jar containing one mod that uses this modLoader

### Supported fields (projects):
Project fields combinations are checked per-projects.

- **projectName** - returns only projects that have at least one jar containing one mod that matches projectName
- **tags** - returns only projects that have this tag listed

---

If no field is provided (Example 2), it'll be interpreted as a wildcard search on the projectName field.

Example 1: \`modId:magic-feather name:"Magic Feather" modLoader:FORGE minecraftVersion:(1.16.4 OR 1.16.5)\`  
Example 2: \`Magic Feather\` (interpreted as \`projectName:"*Magic Feather*"\`).
`,
  })
  async searchProjects(
    @Args('query', { nullable: true, type: () => String }) query: string | null,
    @First() first: number | null,
    @After() after: string | null,
  ) {

    return sequelizeCursorToConnection(
      async () => this.projectSearchService.searchProjects(query, { first, after }),
    );
  }
}

export { ProjectSearchResolver };
