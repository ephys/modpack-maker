import { Args, Query, registerEnumType, Resolver } from '@nestjs/graphql';
import { ProjectConnection } from '../mod/project.resolver';
import { PaginationArgs, sequelizeCursorToConnection } from '../utils/graphql-connection-utils';
import { ProjectSearchService, ProjectSearchSortOrder, ProjectSearchSortOrderDirection } from './project-search.service';

registerEnumType(ProjectSearchSortOrderDirection, {
  name: 'ProjectSearchSortOrderDirection',
});

registerEnumType(ProjectSearchSortOrder, {
  name: 'ProjectSearchSortOrder',
});

@Resolver()
class ProjectSearchResolver {
  constructor(
    private readonly projectSearchService: ProjectSearchService,
  ) {
  }

  @Query(() => ProjectConnection, {
    name: 'projects', description: `
*Returns project matching the search query.*  
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

---

The sort-order is query-aware. Meaning that if the query specifies a \`minecraftVersion\` or a \`modLoader\` field:

- The CreationDate used for the sort order will be the date on which these specific versions were first supported by this mod.  
(first in the case of \`ASC\`, last in the case of \`DESC\`)
- The UpdateDate used for the sort order will be the date on which a jar that supports these versions was uploaded.  
(first in the case of \`ASC\`, last in the case of \`DESC\`).
`,
  })
  async searchProjects(
    @Args() pagination: PaginationArgs,
    @Args('query', { nullable: true, type: () => String }) query: string | null,
    @Args('order', { type: () => ProjectSearchSortOrder }) order: ProjectSearchSortOrder,
    @Args('orderDir', { type: () => ProjectSearchSortOrderDirection }) orderDir: ProjectSearchSortOrderDirection,
  ) {

    // TODO: order

    return sequelizeCursorToConnection(
      async () => this.projectSearchService.searchProjects(query, pagination),
      {
        totalCount: async () => this.projectSearchService.countProjects(query),
      },
    );
  }
}

export { ProjectSearchResolver };
