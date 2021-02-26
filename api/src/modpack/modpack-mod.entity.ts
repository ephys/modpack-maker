import * as DB from 'sequelize-typescript';
import { Modpack } from './modpack.entity';
import { ModJar } from '../mod/mod-jar.entity';
import { Field as GraphQl, ID, ObjectType as GraphQlObject } from '@nestjs/graphql';

@GraphQlObject()
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

  @DB.Column
  @GraphQl(() => Boolean)
  isLibraryDependency: boolean;

  @DB.Column
  @GraphQl(() => String, { name: 'addedAt' })
  createdAt: Date;
}
