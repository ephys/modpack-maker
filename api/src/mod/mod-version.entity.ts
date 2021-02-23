import * as DB from 'sequelize-typescript';

@DB.Table
export class ModVersion extends DB.Model<ModVersion> {

  @DB.AllowNull(false)
  @DB.PrimaryKey
  @DB.AutoIncrement
  @DB.Column(DB.DataType.INTEGER)
  internalId: number;

  // mod id
  // version key
  // mc version id
  // modLoader id
  // file url
}
