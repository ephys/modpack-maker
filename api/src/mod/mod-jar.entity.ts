import { Field as GraphQl, ID, ObjectType as GraphQlObject } from '@nestjs/graphql';
import * as DB from 'sequelize-typescript';
import ModpackMod from '../modpack-version/modpack-mod.entity';
import { tsEnum } from '../utils/sequelize-utils';
import { ModVersion } from './mod-version.entity';
import { Project } from './project.entity';

export enum ReleaseType {
  STABLE = 'STABLE',
  BETA = 'BETA',
  ALPHA = 'ALPHA',
}

type TModJarCreationAttributes = {
  externalId?: string,
  releaseType: ReleaseType,
  releaseDate: string,
  projectId: number,
  sourceFileId: string,
  downloadUrl: string,
  fileName: string,
};

/**
 * A ModJar entity is a representation of a .jar file
 *
 * A single ModJar contains one or more {@link ModVersion}
 */
@DB.Table
@GraphQlObject()
export class ModJar extends DB.Model<ModJar, TModJarCreationAttributes> {

  @DB.AllowNull(false)
  @DB.PrimaryKey
  @DB.AutoIncrement
  @DB.Column(DB.DataType.INTEGER)
  internalId: number;

  @GraphQl(() => ID, { name: 'id' })
  @DB.AllowNull(false)
  @DB.Unique
  @DB.Column(DB.DataType.TEXT)
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

  @DB.ForeignKey(() => Project)
  @DB.Column(DB.DataType.INTEGER)
  projectId: number;

  @DB.AllowNull(false)
  @DB.Unique
  @DB.Column(DB.DataType.TEXT)
  /**
   * For ID of the file in the source (curse / modrinth)'s database
   *
   * @type {number}
   */
  sourceFileId: string;

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
