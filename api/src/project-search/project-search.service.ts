import type { FindByCursorResult } from '@ephys/sequelize-cursor-pagination';
import { sequelizeFindByCursor } from '@ephys/sequelize-cursor-pagination';
import { Inject } from '@nestjs/common';
import * as Lucene from 'lucene';
import type { AST, LeftOnlyAST, Node, NodeRangedTerm, NodeTerm, NodeField, Operator } from 'lucene';
import type { AndOperator, OrOperator, WhereOperators, WhereOptions } from 'sequelize';
import SequelizePkg from 'sequelize';
import { parseMinecraftVersionThrows, serializeMinecraftVersion } from '../../../common/minecraft-utils';
import minecraftVersions from '../../../common/minecraft-versions.json';
import { EMPTY_ARRAY } from '../../../common/utils';
import { SEQUELIZE_PROVIDER } from '../database/database.providers';
import { Op, QueryTypes, Sequelize } from '../esm-compat/sequelize-esm';
import { ModJar } from '../mod/mod-jar.entity';
import { Project } from '../project/project.entity';
import { lastItem } from '../utils/generic-utils';
import type { ICursorPagination, IOffsetPagination } from '../utils/graphql-connection-utils';
import { isCursorPagination, normalizePagination } from '../utils/graphql-connection-utils';
import { getMinecraftVersionsInRange } from '../utils/minecraft-utils';
import {
  and,
  andWhere,
  buildOrder,
  buildWhereComponent,
  contains,
  iLike,
  not, notEqual,
  overlap,
} from '../utils/sequelize-utils';

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

const oldestMcVersion = lastItem(minecraftVersions)!;
const newestMcVersion = minecraftVersions[0]!;

const ProjectSearchLuceneConfig: TLuceneToSqlConfig = {
  ranges: ['minecraftVersion'],
  fields: ['minecraftVersion', 'modLoader', 'modId', 'modName', 'projectName', 'tags', 'source'],
  implicitField: 'projectName',
  cast: {
    minecraftVersion: 'text[]',
  },
  whereBuilder: {
    // @ts-expect-error
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
  fieldMap: {
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
        luceneQuery ? internalProcessSearchProjectsLucene(luceneQuery, ProjectSearchLuceneConfig) : true,
        { sourceSlug: notEqual(null) },
        SequelizePkg.where(
          SequelizePkg.fn('char_length', SequelizePkg.col('name')),
          Op.gt,
          `0`,
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
    // @ts-expect-error to fix
    const pagination = normalizePagination(paginationArg, 20);

    const orderKey = order === ProjectSearchSortOrder.ProjectName ? 'name'
      : order === ProjectSearchSortOrder.LastFileUpload ? 'lastFileUploadedAt'
      : 'firstFileUploadedAt';

    // TODO: support detecting MCCreator mods

    return sequelizeFindByCursor({
      // @ts-expect-error
      model: Project,
      order: [[orderKey, orderDir]],
      ...(isCursorPagination(pagination) ? pagination : { first: pagination.limit }),
      findAll: async query => {
        // convert Lucene query to SQL query
        const luceneQueryWhere = !luceneQuery
          ? undefined
          : internalProcessSearchProjectsLucene(luceneQuery, ProjectSearchLuceneConfig);

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
          LIMIT ${query.limit} ${!isCursorPagination(pagination) ? `OFFSET ${pagination.offset}` : ''};
        `, {
          type: QueryTypes.SELECT,
          mapToModel: true,
          model: Project,
        });
      },
    });
  }
}

type TNodePartWhere = OrOperator<any> | AndOperator<any> | WhereOperators;
type TWhereBuilder = (node: Node) => TNodePartWhere;

export type TLuceneToSqlConfig = {
  fieldMap?: { [luceneField: string]: string },
  cast?: { [luceneField: string]: string },
  whereBuilder?: { [luceneField: string]: TWhereBuilder },
  ranges?: string[],
  fields?: string[],
  implicitField: string,
};

export function internalProcessSearchProjectsLucene(query: string, config: TLuceneToSqlConfig): WhereOptions {
  const lucene: AST = Lucene.parse(query);

  return processLuceneAst(lucene, config);
}

function isNode(val: any): val is Node {
  return 'field' in val;
}

function isLeftOnlyAst(val: any): val is LeftOnlyAST {
  return 'left' in val && !('op' in val) && !('right' in val);
}

export function isNodeRangedTerm(val: any): val is NodeRangedTerm {
  return isNode(val) && 'inclusive' in val;
}

export function isNodeTerm(val: any): val is NodeTerm {
  return isNode(val) && 'term' in val;
}

function processLuceneAst(node: AST | Node, config: TLuceneToSqlConfig, inverse = false): WhereOptions {
  if (isNode(node)) {
    return processNamedLuceneNode(node, config, inverse);
  }

  if (isLeftOnlyAst(node)) {
    if (node.start === 'NOT') {
      return processLuceneAst({
        ...node.left,
        start: node.start,
      }, config, !inverse);
    }

    if (node.start) {
      throw new Error(`Do not know how to handle node.start ${node.start}`);
    }

    return processLuceneAst(node.left, config, inverse);
  }

  const op = node.operator;

  switch (op) {
    case 'AND':
    case '<implicit>':
      return {
        [inverse ? Op.or : Op.and]: [
          processLuceneAst(node.left, config, inverse),
          processLuceneAst(node.right, config, inverse),
        ],
      };

    case 'OR':
      return {
        [inverse ? Op.and : Op.or]: [
          processLuceneAst(node.left, config),
          processLuceneAst(node.right, config),
        ],
      };

    case 'NOT': // <implicit> NOT
    case 'AND NOT':
      return {
        [inverse ? Op.or : Op.and]: [
          processLuceneAst(node.left, config, inverse),
          processLuceneAst(node.right, config, !inverse),
        ],
      };

    case 'OR NOT':
      return {
        [inverse ? Op.and : Op.or]: [
          processLuceneAst(node.left, config, inverse),
          processLuceneAst(node.right, config, !inverse),
        ],
      };

    default:
      throw new Error(`unknown operator ${op}`);
  }
}

function processNamedLuceneNode(node: Node, config: TLuceneToSqlConfig, inverse: boolean): WhereOptions {

  if (node.field === '<implicit>') {
    node.field = config.implicitField;
    if (isNodeTerm(node)) {
      node.term = `*${node.term}*`;
    }
  }

  const sqlField = config.fieldMap?.[node.field] ?? node.field;
  const castAs = config.cast?.[node.field] ?? 'text';

  const out = SequelizePkg.where(
    SequelizePkg.cast(SequelizePkg.col(sqlField), castAs),
    processLuceneNodePart(node, node.field, config),
  );

  if (inverse) {
    return not(out);
  }

  return out;
}

interface OperatorNodeField extends NodeField {
  operator: 'AND' | 'OR';
  right: Node;
  left: Node;
}

interface ParenthesizedNodeField extends NodeField {
  parenthesized: true;
  left: Node;
  start?: Operator | undefined;
}

function isOperatorNode(val: any): val is OperatorNodeField {
  return 'operator' in val && val.operator != null;
}

function isParenthesizedNode(val: any): val is ParenthesizedNodeField {
  return 'parenthesized' in val && val.parenthesized === true;
}

function processLuceneNodePart(
  node: Node,
  fieldName: string,
  config: TLuceneToSqlConfig,
): TNodePartWhere {
  if (isOperatorNode(node)) {
    switch (node.operator) {
      case 'AND':
        return {
          [Op.and]: [
            processLuceneNodePart(node.left, fieldName, config),
            processLuceneNodePart(node.right, fieldName, config),
          ],
        };

      case 'OR':
        return {
          [Op.or]: [
            processLuceneNodePart(node.left, fieldName, config),
            processLuceneNodePart(node.right, fieldName, config),
          ],
        };

      default:
        throw new Error(`Unknown leaf operator ${node.operator} `);
    }
  }

  if (isParenthesizedNode(node)) {
    if (node.start === 'NOT') {
      return not(processLuceneNodePart(node.left, fieldName, config));
    }

    if (node.start) {
      throw new Error(`Do not know how to handle node.start ${node.start}`);
    }

    return processLuceneNodePart(node.left, fieldName, config);
  }

  const callCustomBuilder = config.whereBuilder?.[fieldName];

  if (isNodeRangedTerm(node)) {
    const ranges: readonly string[] = config.ranges ?? EMPTY_ARRAY;

    if (!ranges.includes(fieldName)) {
      // TODO expose to client
      throw new Error(`Field ${JSON.stringify(fieldName)} is not a range. Valid ranges: ${JSON.stringify(ranges)}`);
    }

    if (callCustomBuilder) {
      return callCustomBuilder(node);
    }

    return luceneRangedTermToSql(node);

  }

  const fields: readonly string[] = config.fields ?? EMPTY_ARRAY;
  if (!fields.includes(fieldName)) {
    // TODO expose to client
    throw new Error(`Field ${JSON.stringify(fieldName)} is not recognised. Valid fields: ${JSON.stringify(fields)}`);
  }

  if (callCustomBuilder) {
    return callCustomBuilder(node);
  }

  return luceneTermToSqlLike(node);
}

function luceneRangedTermToSql(node: NodeRangedTerm): TNodePartWhere {
  const min = node.term_min;
  const max = node.term_max;

  let gtOp;
  let ltOp;

  switch (node.inclusive) {
    case 'both':
      gtOp = Op.gte;
      ltOp = Op.lte;
      break;

    case 'left':
      gtOp = Op.gte;
      ltOp = Op.lt;
      break;

    case 'right':
      gtOp = Op.gt;
      ltOp = Op.lte;
      break;

    case 'none':
      gtOp = Op.gt;
      ltOp = Op.lt;
      break;

    default:
      throw new Error(`unknown inclusiveness ${node.inclusive}`);
  }

  return {
    [gtOp]: min,
    [ltOp]: max,
  };
}

/**
 * Converts lucene term syntax into something compatible with SQL "LIKE"
 * Only supports ? & * wildcards
 */
function luceneTermToSqlLike(node: NodeTerm): TNodePartWhere {
  let term = node.term;

  // unescape lucene characters (except ? & *)
  // + - && || ! ( ) { } [ ] ^ " ~ * ? : \

  term = term.replaceAll(/\\([+\-!(){}[\]^"~:])/g, '$1')
    .replaceAll(`\\&&`, '&&')
    .replaceAll(`\\||`, '||');

  // escape postgre characters
  term = term
    .replaceAll('\\', '\\\\')
    .replaceAll(`'`, `\\'`)
    .replaceAll('|', '\\|')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')
    .replaceAll('{', '\\{')
    .replaceAll('(', '\\(')
    .replaceAll('[', '\\[');

  // actual search terms (if not escaped)
  // "\*" raw input should become "*"
  // and "*", "\\*", etc... should become "%"
  // --
  // but! because the pgescape transforms "\" into "\\" (to escape the /)
  // "\\*" should become "*"
  // and "*", "\\\*", etc... should become "%"
  term = term.replaceAll(/(?<!\\)((?:\\\\\\\\)+)?\*/g, '$1%')
    .replaceAll(/(?<!\\)((?:\\\\\\\\)+)?\?/g, '$1_');

  // remove single \ in front of escaped * & ? characters as they're not wildcards in SQL LIKE
  term = term.replaceAll(/(?<!\\)((?:\\\\)+)?\\\\\*/g, '$1*')
    .replaceAll(/(?<!\\)((?:\\\\)+)?\\\\\?/g, '$1?');

  // if more than 4 \ & even, cut down by 2

  let out = '';
  let lastIndex = 0;
  for (const match of term.matchAll(/\\{4,}/g)) {
    out += term.substring(lastIndex, match.index);

    const previousLen = match[0].length;
    out += '\\'.repeat(previousLen / 2);

    lastIndex = match.index! + previousLen;
  }

  out += term.substring(lastIndex, term.length);

  return iLike(SequelizePkg.literal(`E'${out}'`));
}

export { ProjectSearchService };
