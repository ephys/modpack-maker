import type { InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { CreationOptional, DataTypes, Model, NonAttribute } from '@sequelize/core';
import * as DB from '@sequelize/core/decorators-legacy';
import { Field as GraphQl, ObjectType as GraphQlObject } from '../esm-compat/nest-graphql-esm.js';
import { ModJar } from '../mod/mod-jar.entity.js';
import { ModpackVersion } from './modpack-version.entity.js';

@GraphQlObject()
export class ModpackMod extends Model<InferAttributes<ModpackMod>, InferCreationAttributes<ModpackMod>> {

  @DB.BelongsTo(() => ModpackVersion, {
    foreignKey: 'modpackVersionId',
    inverse: {
      type: 'hasMany',
      as: 'installedMods',
    },
  })
  declare modpackVersion: NonAttribute<ModpackVersion>;

  @DB.PrimaryKey
  @DB.Attribute(DataTypes.INTEGER)
  declare modpackVersionId: number;

  @DB.BelongsTo(() => ModJar, {
    foreignKey: 'jarId',
    inverse: {
      type: 'hasMany',
      as: 'inModpacks',
    },
  })
  declare jar: NonAttribute<ModJar>;

  @DB.PrimaryKey
  @DB.Attribute(DataTypes.INTEGER)
  declare jarId: number;

  @DB.Attribute(DataTypes.BOOLEAN)
  @GraphQl(() => Boolean)
  declare isLibraryDependency: boolean;

  @GraphQl(() => String, { name: 'addedAt' })
  declare createdAt: CreationOptional<Date>;
}
