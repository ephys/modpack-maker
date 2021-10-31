import { MinLength, MaxLength, IsEnum, IsIn } from 'class-validator';
import minecraftVersions from '../../../common/minecraft-versions.json';
import { ModLoader } from '../../../common/modloaders';
import {
  Mutation,
  Resolver,
  Query,
  Field,
  Args,
  InputType,
  ID,
  registerEnumType, ResolveField, Parent, Int,
} from '../esm-compat/nest-graphql-esm';
import { ReleaseType } from '../mod/mod-jar.entity';
import { ModpackVersion } from '../modpack-version/modpack-version.entity';
import { ModpackVersionService } from '../modpack-version/modpack-version.service';
import { Trim } from '../utils/class-validators';
import { Payload } from '../utils/graphql-payload';
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

@InputType()
class CreateModpackInput {
  @MinLength(1)
  @MaxLength(50)
  @Trim()
  @Field()
  name: string;

  @IsEnum(ModLoader)
  @Field(() => ModLoader)
  modLoader: ModLoader;

  @IsIn(minecraftVersions)
  @Field()
  minecraftVersion: string;
}

@Resolver(() => Modpack)
export class ModpackResolver {

  constructor(
    private readonly modpackService: ModpackService,
    private readonly modpackVersionService: ModpackVersionService,
  ) {}

  @Query(() => Modpack, {
    nullable: true,
    name: 'modpack',
  })
  async getModpack(@Args('id', { type: () => ID }) externalId: string): Promise<Modpack | null> {
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

  @ResolveField('lastVersion', () => ModpackVersion, { nullable: false })
  async getLastModpackVersion(@Parent() modpack: Modpack): Promise<ModpackVersion> {
    return this.modpackVersionService.getLastModpackVersion(modpack);
  }

  @ResolveField('version', () => ModpackVersion, { nullable: true })
  async getModpackVersion(
    @Parent() modpack: Modpack,
    @Args('index', { type: () => Int }) index: number,
  ): Promise<ModpackVersion | null> {
    return this.modpackVersionService.getModpackVersion(modpack, index);
  }
}

