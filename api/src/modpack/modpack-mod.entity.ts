import * as DB from 'sequelize-typescript';
import { Modpack } from './modpack.entity';
import { ModVersion } from '../mod/mod-version.entity';

@DB.Table
export default class ModpackMod extends DB.Model<ModpackMod> {

  @DB.BelongsTo(() => Modpack)
  modpack: Modpack;

  @DB.ForeignKey(() => Modpack)
  @DB.PrimaryKey
  @DB.Column
  modpackId: number;

  @DB.BelongsTo(() => ModVersion)
  mod: ModVersion;

  @DB.ForeignKey(() => ModVersion)
  @DB.PrimaryKey
  @DB.Column
  modId: number;
}
