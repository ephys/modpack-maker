import type { InferAttributes, InferCreationAttributes, NonAttribute } from '@sequelize/core';
import { CreationOptional, DataTypes, Model } from '@sequelize/core';
import * as DB from '@sequelize/core/decorators-legacy';
import { Field as GraphQl, ObjectType as GraphQlObject, ID } from '../esm-compat/nest-graphql-esm.js';
import type { ModpackMod } from '../modpack-version/modpack-mod.entity.js';
import { tsEnum } from '../utils/sequelize-utils.js';
import type { ModVersion } from './mod-version.entity.js';

export enum ReleaseType {
  STABLE = 'STABLE',
  BETA = 'BETA',
  ALPHA = 'ALPHA',
}

/**
 * A ModJar entity is a representation of a .jar file
 *
 * A single ModJar contains one or more {@link ModVersion}
 */
@DB.Table
@GraphQlObject()
export class ModJar extends Model<InferAttributes<ModJar>, InferCreationAttributes<ModJar>> {

  @DB.PrimaryKey
  @DB.AutoIncrement
  @DB.Attribute(DataTypes.INTEGER)
  declare internalId: CreationOptional<number>;

  @GraphQl(() => ID, { name: 'id' })
  @DB.NotNull
  @DB.Unique
  @DB.Attribute(DataTypes.TEXT)
  declare externalId: string;

  @DB.NotNull
  @DB.Attribute(tsEnum(ReleaseType))
  @GraphQl(() => ReleaseType)
  /**
   * Mod version, retrieved from internal files
   *
   * @type {number}
   */
  declare releaseType: ReleaseType;

  @DB.NotNull
  @DB.Attribute(DataTypes.DATE)
  declare releaseDate: string;

  @DB.Attribute(DataTypes.INTEGER)
  declare projectId: number;

  @DB.NotNull
  @DB.Unique
  @DB.Attribute(DataTypes.TEXT)
  /**
   * For ID of the file in the source (curse / modrinth)'s database
   *
   * @type {number}
   */
  declare sourceFileId: string;

  @DB.NotNull
  @DB.Attribute(DataTypes.TEXT)
  @GraphQl(() => String)
  /**
   * Where this version can be downloaded
   *
   * @type {number}
   */
  declare downloadUrl: string;

  @DB.NotNull
  @DB.Attribute(DataTypes.TEXT)
  @GraphQl(() => String)
  /**
   * Where this version can be downloaded
   *
   * @type {number}
   */
  declare fileName: string;

  /** Declared by {@link ModpackMod#jar} */
  declare inModpacks: NonAttribute<ModpackMod[]>;

  /** Declared by {@link ModVersion#jar} */
  declare mods: NonAttribute<ModVersion[]>;
}
