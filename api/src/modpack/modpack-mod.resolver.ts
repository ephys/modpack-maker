import { Args, Field, ID, InputType, Mutation, ObjectType, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ModJar } from '../mod/mod-jar.entity';
import ModpackMod from './modpack-mod.entity';
import { IsBoolean, MinLength } from 'class-validator';
import { ModpackService } from './modpack.service';
import { ModService } from '../mod/mod.service';

@InputType()
class SetModpackJarIsLibraryInput {
  @MinLength(1)
  @Field(() => ID)
  modpackId: string;

  @MinLength(1)
  @Field(() => ID)
  jarId: string;

  @IsBoolean()
  @Field()
  isLibrary: boolean;
}

@ObjectType()
class SetModpackJarIsLibraryPayload {
  @Field()
  node: ModpackMod;

  withNode(node: ModpackMod): this {
    this.node = node;

    return this;
  }
}

@Resolver(() => ModpackMod)
class ModpackModResolver {
  constructor(
    private modpackService: ModpackService,
    private modService: ModService,
  ) {
  }

  @ResolveField('jar', () => ModJar)
  async getModpackModJar(@Parent() modpack: ModpackMod) {
    // TODO: DataLoader
    return modpack.jar || modpack.$get('jar');
  }

  @Mutation(() => SetModpackJarIsLibraryPayload)
  async setModpackJarIsLibrary(@Args('input') input: SetModpackJarIsLibraryInput) {
    const [jar, modpack] = await Promise.all([
      this.modService.getJar(input.jarId),
      this.modpackService.getModpackByEid(input.modpackId),
    ]);

    // TODO: return error if jar / modpack is null

    const modpackMod = await this.modpackService.setModpackJarIsLibrary(modpack, jar, input.isLibrary);

    // TODO: return error if modpackMod is null

    return new SetModpackJarIsLibraryPayload().withNode(modpackMod);
  }
}

export { ModpackModResolver };
