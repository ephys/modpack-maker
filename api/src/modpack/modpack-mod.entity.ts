import { Field as GraphQl, ObjectType as GraphQlObject } from '@nestjs/graphql';
import * as DB from 'sequelize-typescript';
import { ModJar } from '../mod/mod-jar.entity';
import { Modpack } from './modpack.entity';

@GraphQlObject()
@DB.Table
export default class ModpackMod extends DB.Model<ModpackMod> {

  @DB.BelongsTo(() => Modpack)
  modpack: Modpack;

  @DB.ForeignKey(() => Modpack)
  @DB.PrimaryKey
  @DB.Column(DB.DataType.INTEGER)
  modpackId: number;

  @DB.BelongsTo(() => ModJar)
  jar: ModJar;

  @DB.ForeignKey(() => ModJar)
  @DB.PrimaryKey
  @DB.Column(DB.DataType.INTEGER)
  jarId: number;

  @DB.Column(DB.DataType.BOOLEAN)
  @GraphQl(() => Boolean)
  isLibraryDependency: boolean;

  @DB.Column(DB.DataType.DATE)
  @GraphQl(() => String, { name: 'addedAt' })
  createdAt: Date;
}
