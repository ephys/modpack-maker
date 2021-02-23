import * as DB from 'sequelize-typescript';

@DB.Table
export class Mod extends DB.Model<Mod> {
  @DB.AllowNull(false)
  @DB.PrimaryKey
  @DB.AutoIncrement
  @DB.Column(DB.DataType.INTEGER)
  internalId: number;

  // sources -> places to check for updates (array of something)

  // name
  // mod-id
}
