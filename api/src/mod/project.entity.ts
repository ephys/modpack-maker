import { Field, ObjectType } from '@nestjs/graphql';
import * as DB from 'sequelize-typescript';
import { ModJar } from './mod-jar.entity';

export enum ProjectSource {
  MODRINTH = 'MODRINTH',
  CURSEFORGE = 'CURSEFORGE',
}

type TProjectCreationAttributes = {
  internalId?: number,
  sourceId: string,
  sourceType: ProjectSource,
  sourceSlug: string,
  lastSourceEditAt: Date,
  versionListUpToDate?: boolean,
  failedFileIds?: number[],
};

@DB.Table
@ObjectType()
class Project extends DB.Model<Project, TProjectCreationAttributes> {
  @DB.AllowNull(false)
  @DB.PrimaryKey
  @DB.AutoIncrement
  @DB.Column(DB.DataType.INTEGER)
  internalId: number;

  @DB.AllowNull(false)
  @DB.Unique('source-id')
  @DB.Column(DB.DataType.TEXT)
  sourceId: string;

  @DB.AllowNull(true)
  @DB.Unique('source-id')
  @DB.Unique('source-slug')
  @DB.Column(DB.DataType.ENUM(...Object.values(ProjectSource)))
  sourceType: ProjectSource;

  @DB.AllowNull(true)
  @DB.Unique('source-slug')
  @DB.Column(DB.DataType.TEXT)
  /** slug is null if project was deleted */
  sourceSlug: string | null;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.TEXT)
  @Field()
  /** Retrieved from source store */
  name: string;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.DATE)
  lastSourceEditAt: Date;

  @DB.AllowNull(false)
  @DB.Default(false)
  @DB.Column(DB.DataType.BOOLEAN)
  versionListUpToDate: boolean;
  // last crawled

  @DB.AllowNull(false)
  @DB.Default([])
  @DB.Column(DB.DataType.ARRAY(DB.DataType.INTEGER))
  failedFileIds: number[];

  @DB.HasMany(() => ModJar, { foreignKey: 'projectId' })
  jars: ModJar[];
}

export { Project };
