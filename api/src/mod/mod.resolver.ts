import { Args, ID, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ModpackService } from '../modpack/modpack.service';
import { ModJar } from './mod-jar.entity';
import { ModVersion } from './mod-version.entity';

@Resolver(() => ModVersion)
export class ModResolver {
  constructor(
    private readonly modpackService: ModpackService,
  ) {}

  @ResolveField('updatedVersion', () => ModJar, { nullable: true })
  async checkModHasUpdate(
    @Parent() mod: ModVersion,
    @Args('matchingModpack', { type: () => ID }) matchingModpack: string,
  ): Promise<ModJar | null> {
    const currentJarPromise: Promise<ModJar | null> = mod.$get('jar');

    const modpack = await this.modpackService.getModpackByEid(matchingModpack);
    if (modpack == null) {
      return null;
    }

    const update = await this.modpackService.getModIdBestMatchForModpack(modpack, mod.modId);
    const currentJar = await currentJarPromise;

    if (update == null || currentJar == null) {
      return null;
    }

    if (currentJar.internalId === update.internalId) {
      return null;
    }

    return update;
  }
}
