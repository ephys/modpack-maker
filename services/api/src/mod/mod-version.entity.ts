import { ModLoader, minecraftVersions } from '@ephys/modpack-maker-common';
import type { InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model, NonAttribute } from '@sequelize/core';
import * as DB from '@sequelize/core/decorators-legacy';
import { Field, Field as GraphQl, ObjectType as GraphQlObject, ObjectType } from '../esm-compat/nest-graphql-esm.js';
import { tsEnum } from '../utils/sequelize-utils.js';
import { DependencyType } from './dependency-type.js';
import { ModJar } from './mod-jar.entity.js';

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

@DB.Table
@GraphQlObject()
export class ModVersion extends Model<InferAttributes<ModVersion>, InferCreationAttributes<ModVersion>> {

  @DB.BeforeValidate
  static validate(instance: ModVersion) {
    // @ts-expect-error -- null is not allowed but we're doing an early error check
    if (instance.supportedMinecraftVersions.includes(null)) {
      throw new Error(`Mod ${instance.displayName} (${instance.modVersion}) has null in supportedMinecraftVersions`);
    }

    if (instance.supportedMinecraftVersions.length === 0) {
      throw new Error(`Mod ${instance.displayName} (${instance.modVersion}) must support at least one minecraft version`);
    }
  }

  @DB.NotNull
  @DB.PrimaryKey
  @DB.AutoIncrement
  @DB.Attribute(DataTypes.INTEGER)
  declare internalId: NonAttribute<number>;

  @DB.NotNull
  @DB.Attribute(DataTypes.TEXT)
  @GraphQl(() => String, { name: 'modId' })
  declare modId: string;

  @DB.NotNull
  @DB.Attribute(DataTypes.TEXT)
  @GraphQl(() => String, { name: 'name' })
  declare displayName: string;

  @DB.NotNull
  @DB.Attribute(DataTypes.TEXT)
  @GraphQl(() => String, { name: 'modVersion' })
  /**
   * Mod version, retrieved from internal files
   *
   * @type {number}
   */
  declare modVersion: string;

  @DB.NotNull
  @DB.Attribute(DataTypes.ARRAY(DataTypes.ENUM(...minecraftVersions)))
  @GraphQl(() => [String], { name: 'supportedMinecraftVersions' })
  /**
   * Which versions of Minecraft are supported by this mod.
   *
   * Denormalized version of supportedMinecraftVersionRange
   *
   * @type {number}
   */
  declare supportedMinecraftVersions: string[];

  @DB.NotNull
  @DB.Attribute(DataTypes.STRING)
  declare supportedMinecraftVersionRange: string;

  @DB.NotNull
  @DB.Attribute(DataTypes.JSON)
  @GraphQl(() => [GqlModDependency])
  declare dependencies: TModDependency[];

  @DB.NotNull
  @DB.Attribute(tsEnum(ModLoader))
  @GraphQl(() => ModLoader, { name: 'supportedModLoader' })
  /**
   * Which mod loader is supported by this mod (forge vs fabric)
   */
  declare supportedModLoader: ModLoader;

  @DB.BelongsTo(() => ModJar, {
    foreignKey: 'jarId',
    inverse: {
      type: 'hasMany',
      as: 'mods',
    },
  })
  declare jar: NonAttribute<ModJar>;

  @DB.Attribute(DataTypes.INTEGER)
  declare jarId: number;
}
