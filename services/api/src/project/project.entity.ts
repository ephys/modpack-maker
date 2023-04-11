import { CreationOptional, DataTypes, Model, NonAttribute } from '@sequelize/core';
import * as DB from '@sequelize/core/decorators-legacy';
import { Field, ObjectType } from '../esm-compat/nest-graphql-esm.js';
import { ModJar } from '../mod/mod-jar.entity.js';

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

@DB.Table({
  indexes: [
    {
      name: 'source-id',
      unique: true,
      fields: ['sourceId', 'sourceType'],
    },
    {
      name: 'source-slug',
      unique: true,
      fields: ['sourceSlug', 'sourceType'],
    },
  ],
})
@ObjectType()
class Project extends Model<Project, TProjectCreationAttributes> {
  @Field(() => String, { name: 'id' })
  @DB.PrimaryKey
  @DB.AutoIncrement
  @DB.Attribute(DataTypes.INTEGER)
  declare internalId: CreationOptional<number>;

  @Field(() => String)
  @DB.NotNull
  @DB.Attribute(DataTypes.TEXT)
  declare sourceId: string;

  @DB.AllowNull(true)
  @DB.Attribute(DataTypes.ENUM(...Object.values(ProjectSource)))
  declare sourceType: ProjectSource;

  @DB.AllowNull(true)
  @DB.Attribute(DataTypes.TEXT)
  /** slug is null if project was deleted */
  declare sourceSlug: string | null;

  @DB.NotNull
  @DB.Attribute(DataTypes.TEXT)
  @Field()
  /** Retrieved from source store */
  declare name: string;

  @DB.NotNull
  @DB.Attribute(DataTypes.TEXT)
  @Field()
  /** Retrieved from source store */
  declare description: string;

  @DB.NotNull
  @DB.Attribute(DataTypes.TEXT)
  @Field()
  /** Retrieved from source store */
  declare iconUrl: string;

  @DB.NotNull
  @DB.Attribute(DataTypes.DATE)
  declare lastSourceEditAt: Date;

  @DB.NotNull
  @DB.Default(false)
  @DB.Attribute(DataTypes.BOOLEAN)
  declare versionListUpToDate: CreationOptional<boolean>;
  // last crawled

  @DB.NotNull
  @DB.Default({})
  @DB.Attribute(DataTypes.JSON)
  declare failedFiles: CreationOptional<TFileErrors>;

  @DB.HasMany(() => ModJar, { foreignKey: 'projectId' })
  declare jars: NonAttribute<ModJar[]>;
}

export { Project };
