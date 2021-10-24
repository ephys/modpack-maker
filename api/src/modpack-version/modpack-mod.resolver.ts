import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ModJar } from '../mod/mod-jar.entity';
import ModpackMod from './modpack-mod.entity';

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
