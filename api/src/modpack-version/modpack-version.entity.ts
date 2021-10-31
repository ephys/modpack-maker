import * as DB from 'sequelize-typescript';
import { Field as GraphQl, ObjectType as GraphQlObject, ID, Int } from '../esm-compat/nest-graphql-esm';
import { Modpack } from '../modpack/modpack.entity';
import ModpackMod from './modpack-mod.entity';

type TModpackVersionCreationAttributes = {
  externalId: string,
  createdAt?: Date,
  versionIndex: number,
  name: string,
  modpackId: number,
};

@GraphQlObject()
@DB.Table
export class ModpackVersion extends DB.Model<ModpackVersion, TModpackVersionCreationAttributes> {
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

  @DB.CreatedAt
  @DB.Column(DB.DataType.DATE)
  createdAt: Date;

  @GraphQl(() => Int, { name: 'versionIndex' })
  @DB.AllowNull(false)
  @DB.Unique('modpackId-versionIndex')
  @DB.Column(DB.DataType.INTEGER)
  versionIndex: number;

  @GraphQl(() => String)
  @DB.AllowNull(false)
  @DB.Column(DB.DataType.TEXT)
  name: string;

  @DB.HasMany(() => ModpackMod)
  installedMods: ModpackMod[];

  @DB.BelongsTo(() => Modpack)
  modpack: Modpack;

  @DB.ForeignKey(() => Modpack)
  @DB.AllowNull(false)
  @DB.Unique('modpackId-versionIndex')
  @DB.Column(DB.DataType.INTEGER)
  modpackId: number;
}
