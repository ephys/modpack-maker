import * as DB from 'sequelize-typescript';
import * as minecraftVersion from '../../../common/minecraft-versions.json';
import { ModLoader } from '../../../common/modloaders';
import { tsEnum } from '../utils/sequelize-utils';

export enum ReleaseType {
  STABLE = 'STABLE',
  BETA = 'BETA',
  ALPHA = 'ALPHA',
}

@DB.Table
export class ModVersion extends DB.Model<ModVersion> {

  @DB.BeforeValidate
  static validate(instance: ModVersion) {
    if (instance.supportedMinecraftVersions.includes(null)) {
      throw new Error(`Mod ${instance.displayName} (${instance.curseFileId}) has null in supportedMinecraftVersions`);
    }

    if (instance.supportedMinecraftVersions.length === 0) {
      throw new Error(`Mod ${instance.displayName} (${instance.curseFileId}) must support at least one minecraft version`);
    }

    if (instance.supportedModLoaders.includes(null)) {
      throw new Error(`Mod ${instance.displayName} (${instance.curseFileId}) has null in supportedModLoaders`);
    }

    if (instance.supportedModLoaders.length === 0) {
      throw new Error(`Mod ${instance.displayName} (${instance.curseFileId}) must support at least one minecraft version`);
    }
  }

  @DB.AllowNull(false)
  @DB.PrimaryKey
  @DB.AutoIncrement
  @DB.Column(DB.DataType.INTEGER)
  internalId: number;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.TEXT)
  modId: string;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.TEXT)
  displayName: string;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.INTEGER)
  /**
   * For files retrieved from curseforge: The curseforge file ID
   * Used to process the file only once
   *
   * @type {number}
   */
  curseFileId: number;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.TEXT)
  /**
   * Where this version can be downloaded
   *
   * @type {number}
   */
  downloadUrl: string;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.TEXT)
  /**
   * Mod version, retrieved from internal files
   *
   * @type {number}
   */
  modVersion: string;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.ARRAY(DB.DataType.ENUM(...minecraftVersion)))
  /**
   * Which versions of Minecraft are supported by this mod
   *
   * @type {number}
   */
  supportedMinecraftVersions: string[];

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.ARRAY(tsEnum(ModLoader)))
  /**
   * Which versions of Minecraft are supported by this mod
   *
   * @type {number}
   */
  supportedModLoaders: ModLoader[];

  @DB.AllowNull(false)
  @DB.Column(tsEnum(ReleaseType))
  /**
   * Mod version, retrieved from internal files
   *
   * @type {number}
   */
  releaseType: ReleaseType;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.DATE)
  releaseDate: Date;

  // TODO: dependencies
}
