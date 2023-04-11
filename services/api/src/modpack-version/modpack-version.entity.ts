import type { HasManyGetAssociationsMixin } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import * as DB from '@sequelize/core/decorators-legacy';
import { Field as GraphQl, ObjectType as GraphQlObject, ID, Int } from '../esm-compat/nest-graphql-esm.js';
import { Modpack } from '../modpack/modpack.entity.js';
import type { ModpackMod } from './modpack-mod.entity.js';

type TModpackVersionCreationAttributes = {
  externalId: string,
  createdAt?: Date,
  versionIndex: number,
  name: string,
  modpackId: number,
};

@GraphQlObject()
export class ModpackVersion extends Model<ModpackVersion, TModpackVersionCreationAttributes> {
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

  @GraphQl(() => Int, { name: 'versionIndex' })
  @DB.NotNull
  @DB.Unique('modpackId-versionIndex')
  @DB.Attribute(DataTypes.INTEGER)
  declare versionIndex: number;

  @GraphQl(() => String)
  @DB.NotNull
  @DB.Attribute(DataTypes.TEXT)
  declare name: string;

  /**
   * Declared by {@link ModpackMod#modpackVersion}
   */
  declare installedMods: ModpackMod[];
  declare getInstalledMods: HasManyGetAssociationsMixin<ModpackMod>;

  @DB.BelongsTo(() => Modpack, {
    foreignKey: 'modpackId',
    inverse: {
      type: 'hasMany',
      as: 'versions',
    },
  })
  declare modpack: Modpack;

  @DB.NotNull
  @DB.Unique('modpackId-versionIndex')
  @DB.Attribute(DataTypes.INTEGER)
  declare modpackId: number;
}
