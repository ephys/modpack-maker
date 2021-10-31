import { fetchCurseProjectDescription } from '../curseforge.api';
import { Parent, registerEnumType, ResolveField, Resolver } from '../esm-compat/nest-graphql-esm';
import { getModrinthProjectDescription } from '../modrinth.api';
import { Connection } from '../utils/graphql-connection-utils';
import { parseProjectMarkdown } from '../utils/markdown';
import { ModJar } from './mod-jar.entity';
import { Project, ProjectSource } from './project.entity';

const ProjectConnection = Connection(Project);

registerEnumType(ProjectSource, { name: 'ProjectSource' });

@Resolver(Project)
class ProjectResolver {
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

  @ResolveField('jars', () => [ModJar])
  async getProjectJars(@Parent() project: Project): Promise<ModJar[]> {
    return project.$get('jars');
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
}

export { ProjectResolver, ProjectConnection };
