import { Parent, registerEnumType, ResolveProperty, Resolver } from '@nestjs/graphql';
import { Connection } from '../utils/graphql-connection-utils';
import { ModJar } from './mod-jar.entity';
import { Project, ProjectSource } from './project.entity';

const ProjectConnection = Connection(Project);

registerEnumType(ProjectSource, { name: 'ProjectSource' });

@Resolver(Project)
class ProjectResolver {
  @ResolveProperty('homepage', () => String)
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

  @ResolveProperty('jars', () => [ModJar])
  async getProjectJars(@Parent() project: Project): Promise<ModJar[]> {
    return project.$get('jars');
  }

  @ResolveProperty('source', () => ProjectSource)
  getProjectSource(@Parent() project: Project): ProjectSource {
    return project.sourceType;
  }
}

export { ProjectResolver, ProjectConnection };
