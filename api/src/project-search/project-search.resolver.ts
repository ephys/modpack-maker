import { Args, ID, Query, registerEnumType, Resolver } from '../esm-compat/nest-graphql-esm';
import { Project } from '../mod/project.entity';
import { ProjectConnection } from '../mod/project.resolver';
import { CursorPaginationArgs, OffsetPaginationArgs, sequelizeCursorToConnection } from '../utils/graphql-connection-utils';
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

  @Query(() => Project, { name: 'project', nullable: true })
  async getProject(@Args('id', { type: () => ID }) id: string): Promise<Project | null> {
    return this.projectSearchService.getProjectByInternalId(Number(id));
  }

  @Query(() => ProjectConnection, {
    name: 'projects', description: `
*Returns project matching the search query.*  
Uses [lucene syntax](https://lucene.apache.org/core/2_9_4/queryparsersyntax.html)

### Supported fields (mods):

Mods fields combinations \`(modLoader AND minecraftVersion)\` are checked per-mod instead of per-project.
this means that if a Project has two jars, one that supports modLoader and one that supports minecraftVersion, but not
both at the same time, it will not be returned. A single jar needs to support both to be returned.

- **modId** - returns only projects that have at least one jar containing this modId.
- **modName** - returns only projects that have at least one jar containing one mod that matches modName.
- **minecraftVersion** - returns only projects that have at least one jar containing one mod that supports minecraftVersion.
- **modLoader** - returns only projects that have at least one jar containing one mod that uses this modLoader.

### Supported fields (projects):
Project fields combinations are checked per-projects.

- **projectName** - returns only projects that have at least one jar containing one mod that matches projectName.
- **tags** - returns only projects that have this tag listed.
- **source** - returns only projects that have been fetched from a specific source. Supported values: \`modrinth\` or \`curseforge\`.

---

If no field is provided (Example 2), it'll be interpreted as a wildcard search on the projectName field.

Example 1: \`modId:magic-feather name:"Magic Feather" modLoader:FORGE minecraftVersion:(1.16.4 OR 1.16.5)\`  
Example 2: \`Magic Feather\` (interpreted as \`projectName:"*Magic Feather*"\`).

---

The sort-order is query-aware. Meaning that if the query specifies a \`minecraftVersion\` or a \`modLoader\` field:

- With FirstFileUpload, the date used for the sort order will be the date on the oldest file matching the query was uploaded.
   This can be used for eg. "sort by the date on which the projects first supported this minecraft version".
- With LastFileUpload, the used for the sort order will be the date on the most recent file matching the query was uploaded.
   This can be used for eg. "sort by the date on which the projects last published an update compatible with this minecraft version".
`,
  })
  async searchProjects(
    @Args() cursorPagination: CursorPaginationArgs,
    @Args() pagePagination: OffsetPaginationArgs,
    @Args('query', { nullable: true, type: () => String, defaultValue: '' }) query: string,
    @Args('order', { type: () => ProjectSearchSortOrder, defaultValue: ProjectSearchSortOrder.ProjectName }) order: ProjectSearchSortOrder,
    @Args('orderDir', { type: () => ProjectSearchSortOrderDirection, defaultValue: ProjectSearchSortOrderDirection.ASC }) orderDir: ProjectSearchSortOrderDirection,
  ) {
    if (!cursorPagination.isEmpty() && !pagePagination.isEmpty()) {
      // TODO: expose
      throw new Error('Choose between cursor pagination or offset pagination');
    }

    const pagination = pagePagination.isEmpty() ? cursorPagination : pagePagination;

    return sequelizeCursorToConnection(
      async () => this.projectSearchService.searchProjects(query, pagination, order, orderDir),
      {
        totalCount: async () => this.projectSearchService.countProjects(query),
      },
    );
  }
}

export { ProjectSearchResolver };
