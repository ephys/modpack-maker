import * as DB from 'sequelize-typescript';
import { Modpack } from './modpack.entity';
import { ModJar } from '../mod/mod-jar.entity';

@DB.Table
export default class ModpackMod extends DB.Model<ModpackMod> {

  @DB.BelongsTo(() => Modpack)
  modpack: Modpack;

  @DB.ForeignKey(() => Modpack)
  @DB.PrimaryKey
  @DB.Column
  modpackId: number;

  @DB.BelongsTo(() => ModJar)
  jar: ModJar;

  @DB.ForeignKey(() => ModJar)
  @DB.PrimaryKey
  @DB.Column
  jarId: number;
}
