import * as DB from 'sequelize-typescript';
import * as minecraftVersion from '../../../common/minecraft-versions.json';
import { ModLoader } from '../../../common/modloaders';
import { tsEnum } from '../utils/sequelize-utils';

enum ReleaseType {
  RELEASE = 'RELEASE',
  BETA = 'BETA',
  ALPHA = 'ALPHA',
}

@DB.Table
export class ModVersion extends DB.Model<ModVersion> {

  @DB.AllowNull(false)
  @DB.PrimaryKey
  @DB.AutoIncrement
  @DB.Column(DB.DataType.INTEGER)
  internalId: number;

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

  // TODO: dependencies
}
