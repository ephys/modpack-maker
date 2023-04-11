import { parseMinecraftVersionThrows, serializeMinecraftVersion } from '@ephys/modpack-maker-common/minecraft-utils.js';
import minecraftVersions from '@ephys/modpack-maker-common/minecraft-versions.json';
import type { FindByCursorResult } from '@ephys/sequelize-cursor-pagination';
import { sequelizeFindByCursor } from '@ephys/sequelize-cursor-pagination';
import { Inject } from '@nestjs/common';
import { Op, QueryTypes, Sequelize, sql } from '@sequelize/core';
import type { Node } from 'lucene';
import { SEQUELIZE_PROVIDER } from '../database/database.providers.js';
import { ModJar } from '../mod/mod-jar.entity.js';
import { Project } from '../project/project.entity.js';
import type { ICursorPagination, IOffsetPagination } from '../utils/graphql-connection-utils.js';
import { isNormalizedCursorPagination, normalizePagination } from '../utils/graphql-connection-utils.js';
import type { TLuceneToSqlConfig } from '../utils/lucene-to-sequelize.js';
import { isNodeTerm, luceneToSequelize } from '../utils/lucene-to-sequelize.js';
import { getMinecraftVersionsInRange } from '../utils/minecraft-utils.js';
import { and, andWhere, buildOrder, buildWhereComponent, contains, notEqual, overlap } from '../utils/sequelize-utils.js';

export enum ProjectSearchSortOrderDirection {
  DESC = 'DESC',
  ASC = 'ASC',
}

export enum ProjectSearchSortOrder {
  ProjectName = 'ProjectName',
  /**
   * this sort-order is query-aware, meaning that if the query specifies a minecraftVersion or a modLoader,
   * The Date used for the sort order will be the date on the oldest file matching the query was uploaded.
   */
  FirstFileUpload = 'FirstFileUpload', // equals "first time a jar that matches this filter was uploaded"
  /**
   * this sort-order is query-aware, meaning that if the query specifies a minecraftVersion or a modLoader,
   * The UpdateDate used for the sort order will be the date on the most recent file matching the query was uploaded.
   */
  LastFileUpload = 'LastFileUpload', // equals "last time a jar that matches this filter was uploaded"
}

const oldestMcVersion = minecraftVersions.at(-1)!;
const newestMcVersion = minecraftVersions[0]!;

const ProjectSearchLuceneConfig: TLuceneToSqlConfig = {
  ranges: ['minecraftVersion'],
  fields: ['minecraftVersion', 'modLoader', 'modId', 'modName', 'projectName', 'tags', 'source'],
  implicitField: 'projectName',
  cast: {
    minecraftVersion: 'text[]',
  },
  whereBuilder: {
    minecraftVersion: (node: Node) => {
      if (isNodeTerm(node)) {
        return contains(node.term);
      }

      // TODO: expose error to client
      const min = parseMinecraftVersionThrows(node.term_min === '*' ? oldestMcVersion : node.term_min);
      const max = parseMinecraftVersionThrows(node.term_max === '*' ? newestMcVersion : node.term_max);

      const minInclusive = node.inclusive === 'both' || node.inclusive === 'left';
      const maxInclusive = node.inclusive === 'both' || node.inclusive === 'right';

      const semverRange = `${minInclusive ? '>=' : '>'}${serializeMinecraftVersion(min)} ${maxInclusive ? '<=' : '<'}${serializeMinecraftVersion(max)}`;
      const versions: string[] = getMinecraftVersionsInRange(semverRange);

      return overlap(...versions);
    },
  },
  attributeMap: {
    minecraftVersion: 'jars.mods.supportedMinecraftVersions',
    modLoader: 'jars.mods.supportedModLoader',
    modId: 'jars.mods.modId',
    modName: 'jars.mods.displayName',
    projectName: 'name',
    source: 'sourceType',
  },
};

class ProjectSearchService {

  constructor(
    @Inject(SEQUELIZE_PROVIDER)
    private readonly sequelize: Sequelize,
  ) {}

  async countProjects(luceneQuery: string): Promise<number> {
    luceneQuery = luceneQuery.trim();

    return Project.count({
      distinct: true,
      where: and(
        luceneQuery ? luceneToSequelize(luceneQuery, ProjectSearchLuceneConfig) : true,
        { sourceSlug: notEqual(null) },
        sql.where(
          sql.fn('char_length', sql.attribute('name')),
          Op.gt,
          0,
        ),
      ),
      include: [{
        association: Project.associations.jars,
        required: true,
        include: [{
          association: ModJar.associations.mods,
          required: true,
        }],
      }],
    });
  }

  async searchProjects(
    luceneQuery: string,
    paginationArg: ICursorPagination | IOffsetPagination,
    order: ProjectSearchSortOrder,
    orderDir: ProjectSearchSortOrderDirection,
  ): Promise<FindByCursorResult<Project>> {
    luceneQuery = luceneQuery.trim();
    const pagination = normalizePagination(paginationArg, 20);

    const orderKey = order === ProjectSearchSortOrder.ProjectName ? 'name'
      : order === ProjectSearchSortOrder.LastFileUpload ? 'lastFileUploadedAt'
      : 'firstFileUploadedAt';

    return sequelizeFindByCursor<Project>({
      model: Project,
      order: [[orderKey, orderDir]],
      ...(isNormalizedCursorPagination(pagination) ? pagination : { first: pagination.limit }),
      findAll: async query => {
        // convert Lucene query to SQL query
        const luceneQueryWhere = !luceneQuery
          ? undefined
          : luceneToSequelize(luceneQuery, ProjectSearchLuceneConfig);

        // Stateless Cursor Pagination WHERE query
        const paginationWhere = query.where;

        return this.sequelize.query(`
          SELECT p1.*
          FROM (
            SELECT p2.*,
              MIN(jars."releaseDate") as "firstFileUploadedAt",
              MAX(jars."releaseDate") as "lastFileUploadedAt"
            FROM "Projects" p2
              INNER JOIN "ModJars" AS "jars" ON p2."internalId" = "jars"."projectId"
              INNER JOIN "ModVersions" AS "jars->mods" ON "jars"."internalId" = "jars->mods"."jarId"
            WHERE p2."sourceSlug" IS NOT NULL AND char_length(p2."name") > 0
              ${luceneQueryWhere ? andWhere(luceneQueryWhere, Project, 'p2') : ''}
            GROUP BY p2."internalId"
          ) p1
          WHERE ${buildWhereComponent(paginationWhere, Project, 'p1')}
          ORDER BY ${buildOrder(query.order, 'p1', Project)}
          LIMIT ${query.limit} ${!isNormalizedCursorPagination(pagination) ? `OFFSET ${pagination.offset}` : ''};
        `, {
          type: QueryTypes.SELECT,
          mapToModel: true,
          model: Project,
        });
      },
    });
  }
}

export { ProjectSearchService };
