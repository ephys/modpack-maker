import { fetchCurseProjectDescription } from '../curseforge.api';
import { Args, ID, Parent, Query, registerEnumType, ResolveField, Resolver } from '../esm-compat/nest-graphql-esm';
import type { ModJar } from '../mod/mod-jar.entity';
import { ModJarConnection } from '../mod/mod-jar.resolver';
import { ModService } from '../mod/mod.service';
import { getModrinthProjectDescription } from '../modrinth.api';
import type { IConnectionType } from '../utils/graphql-connection-utils';
import { Connection, FuzzyPagination, sequelizeCursorToConnection } from '../utils/graphql-connection-utils';
import { parseProjectMarkdown } from '../utils/markdown';
import { Project, ProjectSource } from './project.entity';
import { ProjectService } from './project.service';

const ProjectConnection = Connection(Project);

registerEnumType(ProjectSource, { name: 'ProjectSource' });

@Resolver(Project)
class ProjectResolver {
  constructor(
    private readonly modService: ModService,
    private readonly projectService: ProjectService,
  ) {}

  @Query(() => Project, { name: 'project', nullable: true })
  async getProject(@Args('id', { type: () => ID }) id: string): Promise<Project | null> {
    return this.projectService.getProjectByInternalId(Number(id));
  }

  @ResolveField('homepage', () => String)
  getProjectHomepage(@Parent() project: Project): string {
    switch (project.sourceType) {
      case ProjectSource.CURSEFORGE:
        return `https://www.curseforge.com/minecraft/mc-mods/${encodeURIComponent(project.sourceSlug!)}`;

      case ProjectSource.MODRINTH:
        return `https://modrinth.com/mod/${encodeURIComponent(project.sourceSlug ?? project.sourceId)}`;

      default:
        throw new Error(`Unknown source type ${project.sourceType}`);
    }
  }

  @ResolveField('jars', () => [ModJarConnection])
  async getProjectJars(
    @Parent() project: Project,
    @Args() pagination: FuzzyPagination,
  ): Promise<IConnectionType<ModJar>> {
    return sequelizeCursorToConnection(
      async () => this.modService.getProjectJars(project, pagination),
      {
        totalCount: async () => this.modService.countProjectJars(project),
      },
    );
  }

  @ResolveField('source', () => ProjectSource)
  getProjectSource(@Parent() project: Project): ProjectSource {
    return project.sourceType;
  }

  // TODO: cache
  @ResolveField('longDescription', () => String)
  async getProjectLongDescription(@Parent() project: Project) {
    const { sourceId, sourceType } = project;

    if (sourceType === ProjectSource.MODRINTH) {
      // TODO: handle errors
      const data = await getModrinthProjectDescription(sourceId);

      return parseProjectMarkdown(data);
    }

    // TODO: handle errors
    return fetchCurseProjectDescription(sourceId);
  }

  @ResolveField('longDescriptionIfReady', () => String, {
    nullable: true, description: `
Works like \`longDescription\`,
but returns null if the the value has not been loaded & cached yet.
  `.trim(),
  })
  async getProjectLongDescriptionIfReady(): Promise<string | null> {
    return null;
  }
}

export { ProjectResolver, ProjectConnection };
