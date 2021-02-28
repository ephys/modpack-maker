import {
  Mutation,
  ObjectType,
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
import { ModpackService } from './modpack.service';
import { Modpack } from './modpack.entity';
import { ModLoader } from '../../../common/modloaders';
import * as minecraftVersions from '../../../common/minecraft-versions.json';
import { ModVersion } from '../mod/mod-version.entity';
import { ModJar, ReleaseType } from '../mod/mod-jar.entity';
import { ModService } from '../mod/mod.service';
import ModpackMod from './modpack-mod.entity';

registerEnumType(ModLoader, {
  name: 'ModLoader',
});

registerEnumType(ReleaseType, {
  name: 'ReleaseType',
});

@ObjectType()
class CreateModpackPayload {
  @Field()
  node: Modpack;

  withNode(node: Modpack): this {
    this.node = node;

    return this;
  }
}

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
    private modpackService: ModpackService,
    private modService: ModService,
  ) {}

  @Query(() => Modpack, {
    nullable: true,
    name: 'modpack',
  })
  getModpack(@Args('id', { type: () => ID }) externalId: string) {
    return this.modpackService.getModpackByEid(externalId);
  }

  @Query(() => [Modpack], {
    nullable: true,
    name: 'modpacks',
  })
  getModpacks() {
    return this.modpackService.getModpacks();
  }

  @Mutation(() => CreateModpackPayload)
  async createModpack(@Args('input') input: CreateModpackInput) {
    const modpack = await this.modpackService.createModpack(input);

    return new CreateModpackPayload().withNode(modpack);
  }

  @Mutation(() => CreateModpackPayload)
  async addModToModpack(@Args('input') input: AddModpackModInput): Promise<CreateModpackPayload> {
    const modpack = await this.modpackService.getModpackByEid(input.modpackId);

    // TODO: error if modpack = null

    await this.modpackService.addModUrlsToModpack(modpack, input.byUrl);

    return new CreateModpackPayload().withNode(modpack);
  }

  @Mutation(() => CreateModpackPayload)
  async removeJarFromModpack(@Args('input') input: RemoveJarFromModpackInput): Promise<CreateModpackPayload> {
    const [modpack, jar] = await Promise.all([
      this.modpackService.getModpackByEid(input.modpackId),
      this.modService.getJar(input.jarId),
    ]);

    // TODO: error if modpack = null
    // TODO: error if jar = null

    await this.modpackService.removeJarFromModpack(modpack, jar);

    return new CreateModpackPayload().withNode(modpack);
  }

  @Mutation(() => CreateModpackPayload)
  async replaceModpackJar(@Args('input') input: ReplaceModpackJarInput): Promise<CreateModpackPayload> {
    console.log(input);
    const [modpack, oldJar, newJar] = await Promise.all([
      this.modpackService.getModpackByEid(input.modpackId),
      this.modService.getJar(input.oldJarId),
      this.modService.getJar(input.newJarId),
    ]);

    // TODO: entity missing errors

    await this.modpackService.replaceModpackJar(modpack, oldJar, newJar);

    return new CreateModpackPayload().withNode(modpack);
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

