import { QueryTypes, Sequelize } from '@sequelize/core';
import { InjectSequelize } from '../database/database.providers.js';
import { Field, Int, ObjectType } from '../esm-compat/nest-graphql-esm.js';
import { getBySinglePropertyDl } from '../utils/dataloader.js';
import { Project } from './project.entity.js';

@ObjectType()
export class ErrorWithCount {
  @Field(() => String)
    description: string;

  @Field(() => Int)
    count: number;
}

export class ProjectService {
  getProjectByInternalId = getBySinglePropertyDl(Project, 'internalId');

  constructor(@InjectSequelize private readonly sequelize: Sequelize) {}

  async getProjectErrors(): Promise<ErrorWithCount[]> {
    return this.sequelize.query<ErrorWithCount>(`
SELECT error as description, COUNT(error) as count FROM (
  SELECT jsonb_array_elements_text(jsonb_path_query_array("failedFiles"::JSONB, '$.*')) AS error
  FROM "Projects"
) AS failed_files
GROUP BY error
ORDER BY COUNT(error) DESC
LIMIT 100;
`, { type: QueryTypes.SELECT });
  }
}
