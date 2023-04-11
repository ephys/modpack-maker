import { Parent, ResolveField, Resolver } from '../esm-compat/nest-graphql-esm.js';
import { ModJar } from '../mod/mod-jar.entity.js';
import { ModpackMod } from './modpack-mod.entity.js';

@Resolver(() => ModpackMod)
class ModpackModResolver {

  @ResolveField('jar', () => ModJar)
  async getModpackModJar(@Parent() modpack: ModpackMod) {
    // TODO: DataLoader
    if (!modpack.jar) {
      throw new Error('DataLoader NYI');
    }

    return modpack.jar;
  }
}

export { ModpackModResolver };
