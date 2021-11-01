import * as DB from 'sequelize-typescript';
import { Field, ObjectType } from '../esm-compat/nest-graphql-esm';
import { ModJar } from '../mod/mod-jar.entity';

export enum ProjectSource {
  MODRINTH = 'MODRINTH',
  CURSEFORGE = 'CURSEFORGE',
}

type TFileErrors = { [key: string]: string };

export type TProjectCreationAttributes = {
  internalId?: number,
  sourceId: string,
  sourceType: ProjectSource,
  sourceSlug: string,
  lastSourceEditAt: Date,
  name: string,
  description: string,
  iconUrl: string,
  versionListUpToDate?: boolean,
  failedFiles?: TFileErrors,
};

@DB.Table
@ObjectType()
class Project extends DB.Model<Project, TProjectCreationAttributes> {
  @Field(() => String, { name: 'id' })
  @DB.AllowNull(false)
  @DB.PrimaryKey
  @DB.AutoIncrement
  @DB.Column(DB.DataType.INTEGER)
  internalId: number;

  @Field(() => String)
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
  @DB.Column(DB.DataType.TEXT)
  @Field()
  /** Retrieved from source store */
  description: string;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.TEXT)
  @Field()
  /** Retrieved from source store */
  iconUrl: string;

  @DB.AllowNull(false)
  @DB.Column(DB.DataType.DATE)
  lastSourceEditAt: Date;

  @DB.AllowNull(false)
  @DB.Default(false)
  @DB.Column(DB.DataType.BOOLEAN)
  versionListUpToDate: boolean;
  // last crawled

  @DB.AllowNull(false)
  @DB.Default({})
  @DB.Column(DB.DataType.JSON)
  failedFiles: TFileErrors;

  @DB.HasMany(() => ModJar, { foreignKey: 'projectId' })
  jars: ModJar[];
}

export { Project };
