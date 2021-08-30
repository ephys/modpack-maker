import { Args, Field, ID, InputType, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { IsBoolean, MinLength } from 'class-validator';
import { ModJar } from '../mod/mod-jar.entity';
import { ModService } from '../mod/mod.service';
import { Payload } from '../utils/graphql-payload';
import ModpackMod from './modpack-mod.entity';
import { ModpackService } from './modpack.service';

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

enum SetModpackJarIsLibraryErrorCode {
  MODPACK_NOT_FOUND = 'MODPACK_NOT_FOUND',
  JAR_NOT_FOUND = 'JAR_NOT_FOUND',
  JAR_NOT_IN_MODPACK = 'JAR_NOT_IN_MODPACK',
}

const SetModpackJarIsLibraryPayload = Payload('SetModpackJarIsLibrary', ModpackMod, SetModpackJarIsLibraryErrorCode);

@Resolver(() => ModpackMod)
class ModpackModResolver {
  constructor(
    private readonly modpackService: ModpackService,
    private readonly modService: ModService,
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

    if (modpack == null) {
      return new SetModpackJarIsLibraryPayload().withError(SetModpackJarIsLibraryErrorCode.MODPACK_NOT_FOUND, `modpack ${input.modpackId} not found`);
    }

    if (jar == null) {
      return new SetModpackJarIsLibraryPayload().withError(SetModpackJarIsLibraryErrorCode.JAR_NOT_FOUND, `Jar ${input.jarId} not found`);
    }

    const modpackMod = await this.modpackService.setModpackJarIsLibrary(modpack, jar, input.isLibrary);
    if (modpackMod == null) {
      return new SetModpackJarIsLibraryPayload().withError(SetModpackJarIsLibraryErrorCode.JAR_NOT_IN_MODPACK, `Jar ${input.jarId} is not in the modpack ${input.modpackId}`);
    }

    return new SetModpackJarIsLibraryPayload().withNode(modpackMod);
  }
}

export { ModpackModResolver };
