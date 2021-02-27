import {
  Resolver,
  ResolveField, Parent, registerEnumType,
} from '@nestjs/graphql';
import { ModVersion } from './mod-version.entity';
import { ModJar } from './mod-jar.entity';
import { ModService } from './mod.service';
import { DependencyType } from '../../../common/dependency-type';

registerEnumType(DependencyType, {
  name: 'DependencyType',
});

@Resolver(() => ModJar)
export class ModJarResolver {

  constructor(private modService: ModService) {}

  // TODO: Pagination
  @ResolveField('mods', () => [ModVersion])
  async getModpackMods(@Parent() jar: ModJar): Promise<ModVersion[]> {
    return this.modService.getModsInJar(jar);
  }

  @ResolveField('curseForgePage', () => String)
  async getCurseForgePageUrl(@Parent() jar: ModJar): Promise<string> {
    return this.modService.getCurseForgeProjectUrl(jar.curseProjectId);
  }
}

