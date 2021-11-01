import { Args, ID, Parent, Query, registerEnumType, ResolveField, Resolver } from '../esm-compat/nest-graphql-esm';
import { ModpackService } from '../modpack/modpack.service';
import { Project } from '../project/project.entity';
import { ProjectService } from '../project/project.service';
import type { IConnectionType } from '../utils/graphql-connection-utils';
import {
  Connection, EMPTY_CONNECTION,
  FuzzyPagination,
  sequelizeCursorToConnection,
} from '../utils/graphql-connection-utils';
import { DependencyType } from './dependency-type';
import { ModJar } from './mod-jar.entity';
import { ModVersion } from './mod-version.entity';
import { ModService } from './mod.service';

registerEnumType(DependencyType, {
  name: 'DependencyType',
});

export const ModJarConnection = Connection(ModJar);

@Resolver(() => ModJar)
export class ModJarResolver {

  constructor(
    private readonly projectService: ProjectService,
    private readonly modService: ModService,
    private readonly modpackService: ModpackService,
  ) {}

  @Query(() => ModJar, { name: 'jar', nullable: true })
  async getJar(@Args('id', { type: () => ID }) id: string) {
    return this.modService.getJarByExternalId(id);
  }

  @Query(() => ModJarConnection, {
    name: 'jars', description: `
*Returns the jars of a project matching the search query.*  
Uses [lucene syntax](https://lucene.apache.org/core/2_9_4/queryparsersyntax.html)

### Supported fields (mods):

Mods fields combinations \`(modLoader AND minecraftVersion)\` are checked per-mod instead of per-jar.
this means that if a jar includes two mods, one that supports modLoader and one that supports minecraftVersion, but not
both at the same time, it will not be returned. A single mod needs to support both to be returned.

- **modId** - returns only projects that have at least one jar containing this modId.
- **modName** - returns only projects that have at least one jar containing one mod that matches modName.
- **minecraftVersion** - returns only projects that have at least one jar containing one mod that supports minecraftVersion.
- **modLoader** - returns only projects that have at least one jar containing one mod that uses this modLoader.

### Supported fields (jars):
Project fields combinations are checked per-projects.

- **fileName** - returns only jars whose fileName matches this.

---

If no field is provided (Example 2), it'll be interpreted as a wildcard search on the fileName field.

Example 1: \`modLoader:FORGE minecraftVersion:(1.16.4 OR 1.16.5)\`  
Example 2: \`Quark-r2.4-315\` (interpreted as \`fileName:"*Quark-r2.4-315*"\`).
`,
  })
  async searchJars(
    @Args() pagination: FuzzyPagination,
    @Args('project', { type: () => ID }) projectId: string,
    @Args('query', { type: () => String, defaultValue: '' }) query: string,
  ): Promise<IConnectionType<ModJar>> {
    const project = await this.projectService.getProjectByInternalId(Number(projectId));
    if (project == null) {
      return EMPTY_CONNECTION;
    }

    return sequelizeCursorToConnection(
      async () => this.modService.getProjectJars(project, query, pagination),
      {
        totalCount: async () => this.modService.countProjectJars(project, query),
      },
    );
  }

  @ResolveField('project', () => Project)
  async getJarProject(@Parent() jar: ModJar) {
    return this.projectService.getProjectByInternalId(jar.projectId);
  }

  // TODO: Pagination
  @ResolveField('mods', () => [ModVersion])
  async getModsInJar(
    @Parent() jar: ModJar,
    @Args('matchingModpack', { type: () => ID, nullable: true }) matchingModpack: string | null,
  ): Promise<ModVersion[]> {
    const modpack = matchingModpack ? await this.modpackService.getModpackByEid(matchingModpack) : null;

    return this.modService.getModsInJar(jar, {
      modLoader: modpack?.modLoader,
    });
  }

  @ResolveField('downloadUrl', () => String)
  async getJarDownloadUrl(@Parent() jar: ModJar): Promise<string> {
    // TODO uriTag
    // TODO: configurable domain
    return `http://localhost:8080/jars/${jar.externalId}/download`;
  }

  // TODO: move to Jar
  //  check each modId has an update & which jar(s) to install
  //  only search in same project

  @ResolveField('updatedVersion', () => [ModJar], {
    nullable: false,
    description: `
      returns the list of jars from the same project that are considered updated versions to this jar.
    `,
  })
  async checkModHasUpdate(
    @Parent() jar: ModJar,
    @Args('matchingModpack', { type: () => ID }) matchingModpack: string,
  ): Promise<ModJar[]> {
    const modpack = await this.modpackService.getModpackByEid(matchingModpack);
    if (modpack == null) {
      return [];
    }

    return this.modService.findJarUpdates(jar, modpack.minecraftVersion, modpack.modLoader);
  }
}
