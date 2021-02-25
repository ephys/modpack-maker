import * as DB from 'sequelize-typescript';
import { tsEnum } from '../utils/sequelize-utils';
import ModpackMod from '../modpack/modpack-mod.entity';
import { ModVersion } from './mod-version.entity';
import { Field as GraphQl, ID, ObjectType as GraphQlObject } from '@nestjs/graphql';

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
export class ModJar extends DB.Model<ModJar> {

  @DB.AllowNull(false)
  @DB.PrimaryKey
  @DB.AutoIncrement
  @DB.Column(DB.DataType.INTEGER)
  internalId: number;

  @GraphQl(() => ID, { name: 'id' })
  @DB.AllowNull(false)
  @DB.Unique
  @DB.Column
  externalId: string;

  @DB.AllowNull(false)
  @DB.Column(tsEnum(ReleaseType))
  @GraphQl(() => ReleaseType)
  /**
   * Mod version, retrieved from internal files
   *
   * @type {number}
   */
  releaseType: ReleaseType;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.DATE)
  releaseDate: string;

  @DB.AllowNull(false)
  @DB.Unique
  @DB.Column(DB.DataType.INTEGER)
  /**
   * For files retrieved from curseforge: The curseforge project ID
   * Used for finding mods by curseforge project ID
   *
   * @type {number}
   */
  curseProjectId: number;

  @DB.AllowNull(false)
  @DB.Unique
  @DB.Column(DB.DataType.INTEGER)
  /**
   * For files retrieved from curseforge: The curseforge file ID
   * Used to process the file only once
   *
   * @type {number}
   */
  curseFileId: number;

  @DB.AllowNull(false)
  @DB.Unique
  @DB.Column(DB.DataType.TEXT)
  @GraphQl(() => String)
  /**
   * Where this version can be downloaded
   *
   * @type {number}
   */
  downloadUrl: string;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.TEXT)
  @GraphQl(() => String)
  /**
   * Where this version can be downloaded
   *
   * @type {number}
   */
  fileName: string;

  @DB.HasMany(() => ModpackMod)
  inModpacks: ModpackMod[];

  @DB.HasMany(() => ModVersion)
  mods: ModVersion[];
}
