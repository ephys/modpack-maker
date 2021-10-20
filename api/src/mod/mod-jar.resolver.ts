import { Args, ID, Parent, registerEnumType, ResolveField, Resolver } from '@nestjs/graphql';
import { DependencyType } from '../../../common/dependency-type';
import { ModpackService } from '../modpack/modpack.service';
import { Connection } from '../utils/graphql-connection-utils';
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
    private readonly modService: ModService,
    private readonly modpackService: ModpackService,
  ) {}

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

  @ResolveField('curseForgePage', () => String)
  async getCurseForgePageUrl(@Parent() jar: ModJar): Promise<string> {
    return this.modService.getCurseForgeProjectUrl(jar.projectId);
  }

  @ResolveField('downloadUrl', () => String)
  async getJarDownloadUrl(@Parent() jar: ModJar): Promise<string> {
    // TODO uriTag
    // TODO: configurable domain
    return `http://localhost:8080/jars/${jar.externalId}/download`;
  }
}
