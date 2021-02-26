import * as DB from 'sequelize-typescript';

@DB.Table
export class CurseforgeProject extends DB.Model<CurseforgeProject> {
  @DB.AllowNull(false)
  @DB.PrimaryKey
  @DB.Column(DB.DataType.INTEGER)
  forgeId: number;

  @DB.AllowNull(false)
  @DB.Unique
  @DB.Column(DB.DataType.TEXT)
  slug: string;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.DATE)
  lastForgeEditAt: Date;

  @DB.AllowNull(false)
  @DB.Default(false)
  @DB.Column(DB.DataType.BOOLEAN)
  versionListUpToDate: boolean;
  // last crawled

  @DB.AllowNull(false)
  @DB.Default([])
  @DB.Column(DB.DataType.ARRAY(DB.DataType.INTEGER))
  failedFileIds: number[];
}
