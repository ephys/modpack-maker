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

  @Query(() => ModJarConnection, { name: 'jars' })
  async searchJars(
    @Args() pagination: FuzzyPagination,
    @Args('project', { type: () => ID }) projectId: string,
  ): Promise<IConnectionType<ModJar>> {
    const project = await this.projectService.getProjectByInternalId(Number(projectId));
    if (project == null) {
      return EMPTY_CONNECTION;
    }

    return sequelizeCursorToConnection(
      async () => this.modService.getProjectJars(project, pagination),
      {
        totalCount: async () => this.modService.countProjectJars(project),
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
