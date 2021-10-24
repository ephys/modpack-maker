import { Field as GraphQl, ObjectType as GraphQlObject, ID, Int } from '@nestjs/graphql';
import * as DB from 'sequelize-typescript';
import * as minecraftVersion from '../../../common/minecraft-versions.json';
import { ModLoader } from '../../../common/modloaders';
import { ModpackVersion } from '../modpack-version/modpack-version.entity';
import { tsEnum } from '../utils/sequelize-utils';

type TModpackCreationAttributes = {
  externalId?: string,
  createdAt?: Date,
  name: string,
  modLoader: ModLoader,
  minecraftVersion: string,
};

@GraphQlObject()
@DB.Table
export class Modpack extends DB.Model<Modpack, TModpackCreationAttributes> {
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
  @DB.Column({})
  createdAt: Date;

  @GraphQl(() => String)
  @DB.AllowNull(false)
  @DB.Column(DB.DataType.TEXT)
  name: string;

  @GraphQl(() => ModLoader)
  @DB.AllowNull(false)
  @DB.Column(tsEnum(ModLoader))
  modLoader: ModLoader;

  @GraphQl(() => String)
  @DB.AllowNull(false)
  @DB.Column(DB.DataType.ENUM(...minecraftVersion))
  minecraftVersion: string;

  @GraphQl(() => Int)
  @DB.AllowNull(false)
  @DB.Default(0)
  @DB.Column(DB.DataType.INTEGER)
  lastVersionIndex: number;

  @DB.HasMany(() => ModpackVersion)
  versions: ModpackVersion[];
}
