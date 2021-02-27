import { Args, ID, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ModJar } from './mod-jar.entity';
import { ModVersion } from './mod-version.entity';
import { ModService } from './mod.service';
import { ModpackService } from '../modpack/modpack.service';

@Resolver(() => ModVersion)
export class ModResolver {
  constructor(
    private modService: ModService,
    private modpackService: ModpackService,
  ) {}

  @ResolveField('updatedVersion', () => ModJar, { nullable: true })
  async checkModHasUpdate(
    @Parent() mod: ModVersion,
    @Args('matchingModpack', { type: () => ID }) matchingModpack: string,
  ): Promise<ModJar | null> {
    const currentJarPromise: Promise<ModJar> = mod.$get('jar');

    const modpack = await this.modpackService.getModpackByEid(matchingModpack);
    const update = await this.modpackService.getModIdBestMatchForModpack(modpack,  mod.modId);

    if ((await currentJarPromise).internalId === update.internalId) {
      return null;
    }

    return update;
  }
}
