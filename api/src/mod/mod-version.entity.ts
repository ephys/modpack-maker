import * as DB from 'sequelize-typescript';
import minecraftVersion from '../../../common/minecraft-versions.json';
import { ModLoader } from '../../../common/modloaders';
import {
  Field,
  Field as GraphQl,
  ObjectType,
  ObjectType as GraphQlObject,
} from '../esm-compat/nest-graphql-esm';
import { tsEnum } from '../utils/sequelize-utils';
import { NoEmitDecoratorMetadata } from '../utils/ts-metadata-issue';
import { DependencyType } from './dependency-type';
import { ModJar } from './mod-jar.entity';

export type TModDependency = {
  modId: string,
  versionRange?: string,
  type: DependencyType,
};

@ObjectType()
export class GqlModDependency {
  @Field()
  modId: string;

  @Field({ nullable: true })
  versionRange?: string;

  @Field(() => DependencyType)
  type: DependencyType;
}

type TModVersionCreationAttributes = Partial<{
  internalId: number,
  modId: string,
  displayName: string,
  modVersion: string,
  supportedMinecraftVersions: string[],
  supportedMinecraftVersionRange: string,
  supportedModLoader: ModLoader,
  dependencies: TModDependency[],
  jarId: number,
}>;

@DB.Table
@GraphQlObject()
export class ModVersion extends DB.Model<ModVersion, TModVersionCreationAttributes> {

  @DB.BeforeValidate
  static validate(instance: ModVersion) {
    // @ts-expect-error
    if (instance.supportedMinecraftVersions.includes(null)) {
      throw new Error(`Mod ${instance.displayName} (${instance.modVersion}) has null in supportedMinecraftVersions`);
    }

    if (instance.supportedMinecraftVersions.length === 0) {
      throw new Error(`Mod ${instance.displayName} (${instance.modVersion}) must support at least one minecraft version`);
    }
  }

  @DB.AllowNull(false)
  @DB.PrimaryKey
  @DB.AutoIncrement
  @DB.Column(DB.DataType.INTEGER)
  internalId: number;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.TEXT)
  @GraphQl(() => String, { name: 'modId' })
  modId: string;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.TEXT)
  @GraphQl(() => String, { name: 'name' })
  displayName: string;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.TEXT)
  @GraphQl(() => String, { name: 'modVersion' })
  /**
   * Mod version, retrieved from internal files
   *
   * @type {number}
   */
  modVersion: string;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.ARRAY(DB.DataType.ENUM(...minecraftVersion)))
  @GraphQl(() => [String], { name: 'supportedMinecraftVersions' })
  /**
   * Which versions of Minecraft are supported by this mod.
   *
   * Denormalized version of supportedMinecraftVersionRange
   *
   * @type {number}
   */
  supportedMinecraftVersions: string[];

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.STRING)
  supportedMinecraftVersionRange: string;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.JSON)
  @GraphQl(() => [GqlModDependency])
  dependencies: TModDependency[];

  @DB.AllowNull(false)
  @DB.Column(tsEnum(ModLoader))
  @GraphQl(() => ModLoader, { name: 'supportedModLoader' })
  /**
   * Which mod loader is supported by this mod (forge vs fabric)
   */
  supportedModLoader: ModLoader;

  @DB.BelongsTo(() => ModJar)
  jar: NoEmitDecoratorMetadata<ModJar>;

  @DB.ForeignKey(() => ModJar)
  @DB.Column(DB.DataType.INTEGER)
  jarId: number;
}
