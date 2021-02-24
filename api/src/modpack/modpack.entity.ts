import * as DB from 'sequelize-typescript';
import { Field as GraphQl, ObjectType as GraphQlObject, ID } from '@nestjs/graphql';
import * as minecraftVersion from '../../../common/minecraft-versions.json';
import { ModLoader } from '../../../common/modloaders';
import { tsEnum } from '../utils/sequelize-utils';
import ModpackMod from './modpack-mod.entity';

@GraphQlObject()
@DB.Table
export class Modpack extends DB.Model<Modpack> {
  @DB.AllowNull(false)
  @DB.PrimaryKey
  @DB.AutoIncrement
  @DB.Column(DB.DataType.INTEGER)
  internalId: number;

  @GraphQl(() => ID, { name: 'id' })
  @DB.AllowNull(false)
  @DB.Unique
  @DB.Column
  externalId: string;

  @GraphQl(() => String)
  @DB.AllowNull(false)
  @DB.Column
  name: string;

  @GraphQl(() => ModLoader)
  @DB.AllowNull(false)
  @DB.Column(tsEnum(ModLoader))
  modLoader: string;

  @GraphQl(() => String)
  @DB.AllowNull(false)
  @DB.Column(DB.DataType.ENUM(...minecraftVersion))
  minecraftVersion: string;

  @DB.AllowNull(false)
  @DB.Default([])
  @DB.Column(DB.DataType.ARRAY(DB.DataType.INTEGER))
  pendingCurseForgeProjectIds: number[];

  @DB.HasMany(() => ModpackMod)
  installedMods: ModpackMod[];

  @GraphQl(() => Boolean)
  get processingUrls(): boolean {
    return this.pendingCurseForgeProjectIds.length > 0;
  }
}
