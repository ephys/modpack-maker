import {
  Resolver,
  ResolveField, Parent,
} from '@nestjs/graphql';
import { ModVersion } from './mod-version.entity';
import { ModJar } from './mod-jar.entity';
import { ModService } from './mod.service';

@Resolver(() => ModJar)
export class ModJarResolver {

  constructor(private modService: ModService) {}

  // TODO: Pagination
  @ResolveField('mods', () => [ModVersion])
  async getModpackMods(@Parent() jar: ModJar): Promise<ModVersion[]> {
    return this.modService.getModsInJar(jar);
  }
}

