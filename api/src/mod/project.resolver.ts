import { Parent, ResolveProperty, Resolver } from '@nestjs/graphql';
import { Connection } from '../utils/graphql-connection-utils';
import { ModJar } from './mod-jar.entity';
import { Project } from './project.entity';

const ProjectConnection = Connection(Project);

@Resolver(Project)
class ProjectResolver {
  @ResolveProperty('homepage', () => String)
  getProjectHomepage(@Parent() project: Project): string {
    return `https://www.curseforge.com/minecraft/mc-mods/${encodeURIComponent(project.sourceSlug!)}`;
  }

  @ResolveProperty('jars', () => [ModJar])
  async getProjectJars(@Parent() project: Project): Promise<ModJar[]> {
    return project.$get('jars');
  }
}

export { ProjectResolver, ProjectConnection };
