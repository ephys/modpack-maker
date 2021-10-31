import * as DB from 'sequelize-typescript';
import { Field as GraphQl, ObjectType as GraphQlObject } from '../esm-compat/nest-graphql-esm';
import { ModJar } from '../mod/mod-jar.entity';
import { NoEmitDecoratorMetadata } from '../utils/ts-metadata-issue';
import { ModpackVersion } from './modpack-version.entity';

type TModpackModCreationAttributes = {
  modpackVersionId: number,
  jarId: number,
  isLibraryDependency: boolean,
  createdAt?: Date,
};

@GraphQlObject()
@DB.Table
export default class ModpackMod extends DB.Model<ModpackMod, TModpackModCreationAttributes> {

  @DB.BelongsTo(() => ModpackVersion)
  modpackVersion: ModpackVersion;

  @DB.ForeignKey(() => ModpackVersion)
  @DB.PrimaryKey
  @DB.Column(DB.DataType.INTEGER)
  modpackVersionId: number;

  @DB.BelongsTo(() => ModJar)
  jar: NoEmitDecoratorMetadata<ModJar>;

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
