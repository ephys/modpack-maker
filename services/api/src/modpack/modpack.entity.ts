import minecraftVersion from '@ephys/modpack-maker-common/minecraft-versions.json';
import { ModLoader } from '@ephys/modpack-maker-common/modloaders.js';
import { DataTypes, Model } from '@sequelize/core';
import * as DB from '@sequelize/core/decorators-legacy';
import { Field as GraphQl, ObjectType as GraphQlObject, ID, Int } from '../esm-compat/nest-graphql-esm.js';
import type { ModpackVersion } from '../modpack-version/modpack-version.entity.js';
import { tsEnum } from '../utils/sequelize-utils.js';

type TModpackCreationAttributes = {
  externalId?: string,
  createdAt?: Date,
  name: string,
  modLoader: ModLoader,
  minecraftVersion: string,
};

@GraphQlObject()
export class Modpack extends Model<Modpack, TModpackCreationAttributes> {
  @DB.NotNull
  @DB.PrimaryKey
  @DB.AutoIncrement
  @DB.Attribute(DataTypes.INTEGER)
  declare internalId: number;

  @GraphQl(() => ID, { name: 'id' })
  @DB.NotNull
  @DB.Unique
  @DB.Attribute(DataTypes.TEXT)
  declare externalId: string;

  @DB.CreatedAt
  @DB.Attribute(DataTypes.DATE)
  declare createdAt: Date;

  @GraphQl(() => String)
  @DB.NotNull
  @DB.Attribute(DataTypes.TEXT)
  declare name: string;

  @GraphQl(() => ModLoader)
  @DB.NotNull
  @DB.Attribute(tsEnum(ModLoader))
  declare modLoader: ModLoader;

  @GraphQl(() => String)
  @DB.NotNull
  @DB.Attribute(DataTypes.ENUM(...minecraftVersion))
  declare minecraftVersion: string;

  @GraphQl(() => Int)
  @DB.NotNull
  @DB.Default(0)
  @DB.Attribute(DataTypes.INTEGER)
  declare lastVersionIndex: number;

  /** Declared by {@link ModpackVersion#modpack} */
  declare versions: ModpackVersion[];
}
