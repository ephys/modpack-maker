import { Args, Field, ID, InputType, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ArrayNotEmpty, IsBoolean, MinLength } from 'class-validator';
import { ModJar } from '../mod/mod-jar.entity';
import { ModService } from '../mod/mod.service';
import { Trim } from '../utils/class-validators';
import { Payload } from '../utils/graphql-payload';
import ModpackMod from './modpack-mod.entity';
import { ModpackVersion } from './modpack-version.entity';
import { ModpackVersionService } from './modpack-version.service';

@InputType()
class SetModpackJarIsLibraryInput {
  @MinLength(1)
  @Field(() => ID)
  modpackVersion: string;

  @MinLength(1)
  @Field(() => ID)
  jar: string;

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

@InputType()
class RemoveJarFromModpackInput {
  @Field(() => ID)
  modpackVersion: string;

  @Field(() => ID)
  jar: string;
}

enum RemoveJarFromModpackErrorCodes {
  MODPACK_NOT_FOUND = 'MODPACK_NOT_FOUND',
  JAR_NOT_FOUND = 'JAR_NOT_FOUND',
}

const RemoveJarFromModpackPayload = Payload('RemoveJarFromModpack', ModpackVersion, RemoveJarFromModpackErrorCodes);

@InputType()
class ReplaceModpackJarInput {
  @Field(() => ID)
  modpackVersion: string;

  @Field(() => ID)
  oldJar: string;

  @Field(() => [ID])
  @ArrayNotEmpty()
  newJars: string[];
}

enum ReplaceModpackJarErrorCodes {
  MODPACK_NOT_FOUND = 'MODPACK_NOT_FOUND',
  JAR_NOT_FOUND = 'JAR_NOT_FOUND',
  NEW_JAR_NOT_FOUND = 'JAR_NOT_FOUND',
}

const ReplaceModpackJarPayload = Payload('ReplaceModpackJar', ModpackVersion, ReplaceModpackJarErrorCodes);

@InputType()
class CreateNewModpackVersionInput {
  @Field(() => ID)
  fromModpackVersion: string;

  @Field(() => String)
  @MinLength(1)
  @Trim()
  name: string;
}

enum CreateNewModpackVersionErrorCodes {
  MODPACK_NOT_FOUND = 'MODPACK_NOT_FOUND',
}

const CreateNewModpackVersionPayload = Payload('CreateNewModpackVersion', ModpackVersion, CreateNewModpackVersionErrorCodes);

@Resolver(() => ModpackVersion)
export class ModpackVersionResolver {

  constructor(
    private readonly modpackVersionService: ModpackVersionService,
    private readonly modService: ModService,
  ) {
  }

  @Mutation(() => CreateNewModpackVersionPayload)
  async createNewModpackVersion(@Args('input') input: CreateNewModpackVersionInput) {
    const modpackVersion = await this.modpackVersionService.getModpackVersionByEid(input.fromModpackVersion);
    if (modpackVersion == null) {
      return new CreateNewModpackVersionPayload().withError(
        CreateNewModpackVersionErrorCodes.MODPACK_NOT_FOUND,
        `modpack version ${input.fromModpackVersion} not found`,
      );
    }

    const newVersion = await this.modpackVersionService.createNewVersion(modpackVersion, input.name);

    return new CreateNewModpackVersionPayload().withNode(newVersion);
  }

  @Mutation(() => SetModpackJarIsLibraryPayload)
  async setModpackJarIsLibrary(@Args('input') input: SetModpackJarIsLibraryInput) {
    const [jar, modpack] = await Promise.all([
      this.modService.getJar(input.jar),
      // TODO: nodeService
      this.modpackVersionService.getModpackVersionByEid(input.modpackVersion),
    ]);

    if (modpack == null) {
      return new SetModpackJarIsLibraryPayload().withError(SetModpackJarIsLibraryErrorCode.MODPACK_NOT_FOUND, `modpack version ${input.modpackVersion} not found`);
    }

    if (jar == null) {
      return new SetModpackJarIsLibraryPayload().withError(SetModpackJarIsLibraryErrorCode.JAR_NOT_FOUND, `Jar ${input.jar} not found`);
    }

    const modpackMod = await this.modpackVersionService.setModpackJarIsLibrary(modpack, jar, input.isLibrary);
    if (modpackMod == null) {
      return new SetModpackJarIsLibraryPayload().withError(SetModpackJarIsLibraryErrorCode.JAR_NOT_IN_MODPACK, `Jar ${input.jar} is not in the modpack ${input.modpackVersion}`);
    }

    return new SetModpackJarIsLibraryPayload().withNode(modpackMod);
  }

  @Mutation(() => RemoveJarFromModpackPayload)
  async removeJarFromModpack(@Args('input') input: RemoveJarFromModpackInput): Promise<typeof RemoveJarFromModpackPayload.T> {
    const [modpack, jar] = await Promise.all([
      this.modpackVersionService.getModpackVersionByEid(input.modpackVersion),
      this.modService.getJar(input.jar),
    ]);

    if (modpack == null) {
      return new RemoveJarFromModpackPayload().withError(RemoveJarFromModpackErrorCodes.MODPACK_NOT_FOUND, `modpack version ${input.modpackVersion} not found`);
    }

    if (jar == null) {
      return new RemoveJarFromModpackPayload().withError(RemoveJarFromModpackErrorCodes.JAR_NOT_FOUND, `jar ${input.jar} not found`);
    }

    await this.modpackVersionService.removeJarFromModpack(modpack, jar);

    return new RemoveJarFromModpackPayload().withNode(modpack);
  }

  @Mutation(() => ReplaceModpackJarPayload)
  async replaceModpackJar(@Args('input') input: ReplaceModpackJarInput): Promise<typeof ReplaceModpackJarPayload.T> {
    const [modpack, oldJar, newJars] = await Promise.all([
      this.modpackVersionService.getModpackVersionByEid(input.modpackVersion),
      this.modService.getJar(input.oldJar),
      Promise.all(
        input.newJars.map(async id => this.modService.getJar(id)),
      ),
    ]);

    if (modpack == null) {
      return new ReplaceModpackJarPayload().withError(ReplaceModpackJarErrorCodes.MODPACK_NOT_FOUND, `modpack ${input.modpackVersion} not found`);
    }

    if (oldJar == null) {
      return new ReplaceModpackJarPayload().withError(ReplaceModpackJarErrorCodes.JAR_NOT_FOUND, `jar ${input.oldJar} not found`);
    }

    if (newJars.includes(null)) {
      return new ReplaceModpackJarPayload().withError(ReplaceModpackJarErrorCodes.NEW_JAR_NOT_FOUND, `one of the jars ${input.newJars.join(', ')} was not found`);
    }

    // @ts-expect-error
    await this.modpackVersionService.replaceModpackJar(modpack, oldJar, newJars);

    return new ReplaceModpackJarPayload().withNode(modpack);
  }

  // TODO: Pagination
  @ResolveField('installedJars', () => [ModpackMod])
  async getModpackMods(@Parent() modpack: ModpackVersion): Promise<ModpackMod[]> {
    return this.modpackVersionService.getModpackVersionInstalledJars(modpack);
  }

  @ResolveField('downloadUrl', () => String)
  async getJarDownloadUrl(@Parent() jar: ModJar): Promise<string> {
    // TODO uriTag
    // TODO: configurable domain
    return `http://localhost:8080/modpacks/${jar.externalId}/download`;
  }
}
