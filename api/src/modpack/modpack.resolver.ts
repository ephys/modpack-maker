import {
  Mutation,
  Resolver,
  Query,
  Field,
  Args,
  InputType,
  ID,
  registerEnumType,
  ResolveField, Parent,
} from '@nestjs/graphql';
import { MinLength, MaxLength, IsEnum, IsIn } from 'class-validator';
import * as minecraftVersions from '../../../common/minecraft-versions.json';
import { ModLoader } from '../../../common/modloaders';
import { ModJar, ReleaseType } from '../mod/mod-jar.entity';
import { ModService } from '../mod/mod.service';
import { Payload } from '../utils/graphql-payload';
import ModpackMod from './modpack-mod.entity';
import { Modpack } from './modpack.entity';
import { ModpackService } from './modpack.service';

registerEnumType(ModLoader, {
  name: 'ModLoader',
});

registerEnumType(ReleaseType, {
  name: 'ReleaseType',
});

enum CreateModpackErrorCodes {
}

const CreateModpackPayload = Payload('CreateModpack', Modpack, CreateModpackErrorCodes);

enum AddModpackModErrorCodes {
  MODPACK_NOT_FOUND = 'MODPACK_NOT_FOUND',
}

const AddModpackModPayload = Payload('AddModpackMod', Modpack, AddModpackModErrorCodes);

enum RemoveJarFromModpackErrorCodes {
  MODPACK_NOT_FOUND = 'MODPACK_NOT_FOUND',
  JAR_NOT_FOUND = 'JAR_NOT_FOUND',
}

const RemoveJarFromModpackPayload = Payload('RemoveJarFromModpack', Modpack, RemoveJarFromModpackErrorCodes);

enum ReplaceModpackJarErrorCodes {
  MODPACK_NOT_FOUND = 'MODPACK_NOT_FOUND',
  JAR_NOT_FOUND = 'JAR_NOT_FOUND',
  NEW_JAR_NOT_FOUND = 'JAR_NOT_FOUND',
}

const ReplaceModpackJarPayload = Payload('ReplaceModpackJar', Modpack, ReplaceModpackJarErrorCodes);

@InputType()
class CreateModpackInput {
  @MinLength(1)
  @MaxLength(50)
  @Field()
  name: string;

  @IsEnum(ModLoader)
  @Field(() => ModLoader)
  modLoader: ModLoader;

  @IsIn(minecraftVersions)
  @Field()
  minecraftVersion: string;
}

@InputType()
class ReplaceModpackJarInput {
  @Field(() => ID)
  modpackId: string;

  @Field(() => ID)
  oldJarId: string;

  @Field(() => ID)
  newJarId: string;
}

@InputType()
class AddModpackModInput {
  @Field(() => ID)
  modpackId: string;

  @Field(() => [String])
  byUrl: string[];
}

@InputType()
class RemoveJarFromModpackInput {
  @Field(() => ID)
  modpackId: string;

  @Field(() => ID)
  jarId: string;
}

@Resolver(() => Modpack)
export class ModpackResolver {

  constructor(
    private readonly modpackService: ModpackService,
    private readonly modService: ModService,
  ) {}

  @Query(() => Modpack, {
    nullable: true,
    name: 'modpack',
  })
  async getModpack(@Args('id', { type: () => ID }) externalId: string) {
    return this.modpackService.getModpackByEid(externalId);
  }

  @Query(() => [Modpack], {
    nullable: false,
    name: 'modpacks',
  })
  async getModpacks() {
    return this.modpackService.getModpacks();
  }

  @Mutation(() => CreateModpackPayload)
  async createModpack(@Args('input') input: CreateModpackInput) {
    const modpack = await this.modpackService.createModpack(input);

    return new CreateModpackPayload().withNode(modpack);
  }

  @Mutation(() => AddModpackModPayload)
  async addModToModpack(@Args('input') input: AddModpackModInput): Promise<typeof AddModpackModPayload.T> {
    const modpack: Modpack | null = await this.modpackService.getModpackByEid(input.modpackId);

    if (modpack == null) {
      return new AddModpackModPayload()
        .withError(AddModpackModErrorCodes.MODPACK_NOT_FOUND, `modpack ${input.modpackId} not found`);
    }

    await this.modpackService.addModUrlsToModpack(modpack, input.byUrl);

    return new AddModpackModPayload().withNode(modpack);
  }

  @Mutation(() => RemoveJarFromModpackPayload)
  async removeJarFromModpack(@Args('input') input: RemoveJarFromModpackInput): Promise<typeof RemoveJarFromModpackPayload.T> {
    const [modpack, jar] = await Promise.all([
      this.modpackService.getModpackByEid(input.modpackId),
      this.modService.getJar(input.jarId),
    ]);

    if (modpack == null) {
      return new RemoveJarFromModpackPayload().withError(RemoveJarFromModpackErrorCodes.MODPACK_NOT_FOUND, `modpack ${input.modpackId} not found`);
    }

    if (jar == null) {
      return new RemoveJarFromModpackPayload().withError(RemoveJarFromModpackErrorCodes.JAR_NOT_FOUND, `jar ${input.jarId} not found`);
    }

    await this.modpackService.removeJarFromModpack(modpack, jar);

    return new RemoveJarFromModpackPayload().withNode(modpack);
  }

  @Mutation(() => ReplaceModpackJarPayload)
  async replaceModpackJar(@Args('input') input: ReplaceModpackJarInput): Promise<typeof ReplaceModpackJarPayload.T> {
    const [modpack, oldJar, newJar] = await Promise.all([
      this.modpackService.getModpackByEid(input.modpackId),
      this.modService.getJar(input.oldJarId),
      this.modService.getJar(input.newJarId),
    ]);

    if (modpack == null) {
      return new ReplaceModpackJarPayload().withError(ReplaceModpackJarErrorCodes.MODPACK_NOT_FOUND, `modpack ${input.modpackId} not found`);
    }

    if (oldJar == null) {
      return new ReplaceModpackJarPayload().withError(ReplaceModpackJarErrorCodes.JAR_NOT_FOUND, `jar ${input.oldJarId} not found`);
    }

    if (newJar == null) {
      return new ReplaceModpackJarPayload().withError(ReplaceModpackJarErrorCodes.NEW_JAR_NOT_FOUND, `jar ${input.newJarId} not found`);
    }

    await this.modpackService.replaceModpackJar(modpack, oldJar, newJar);

    return new ReplaceModpackJarPayload().withNode(modpack);
  }

  // TODO: Pagination
  @ResolveField('modJars', () => [ModpackMod])
  async getModpackMods(@Parent() modpack: Modpack): Promise<ModpackMod[]> {
    return this.modpackService.getModpackInstalledJars(modpack);
  }

  @ResolveField('downloadUrl', () => String)
  async getJarDownloadUrl(@Parent() jar: ModJar): Promise<string> {
    // TODO uriTag
    // TODO: configurable domain
    return `http://localhost:8080/modpacks/${jar.externalId}/download`;
  }
}

