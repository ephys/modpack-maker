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

registerEnumType(ModLoader, {
  name: 'ModLoader',
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
class AddModpackModInput {
  @Field(() => ID)
  modpackId: string;

  @Field(() => [String])
  byUrl: string[];
}

@Resolver(() => Modpack)
export class ModpackResolver {

  constructor(private modpackService: ModpackService) {}

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
  async addModpackMod(@Args('input') input: AddModpackModInput): Promise<CreateModpackPayload> {
    const modpack = await this.modpackService.getModpackByEid(input.modpackId);

    await this.modpackService.addModUrlsToModpack(modpack, input.byUrl);

    return new CreateModpackPayload().withNode(modpack);
  }

  // TODO: Pagination
  @ResolveField('mods', () => [ModVersion])
  async getModpackMods(@Parent() modpack: Modpack): Promise<ModVersion[]> {
    return this.modpackService.getModpackMods(modpack);
  }
}

