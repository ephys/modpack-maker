import 'core-js/es/string/replace-all';
import { FindByCursorResult, sequelizeFindByCursor } from '@ephys/sequelize-cursor-pagination';
import { Inject } from '@nestjs/common';
import type { AST, LeftOnlyAST, Node, NodeRangedTerm, NodeTerm } from 'lucene';
import * as Lucene from 'lucene';
import type { AndOperator, OrOperator, WhereOperators, WhereOptions } from 'sequelize';
import { Op, QueryTypes, Sequelize } from 'sequelize';
import { SEQUELIZE_PROVIDER } from '../database/database.providers';
import { Project } from '../mod/project.entity';
import { EMPTY_ARRAY } from '../utils/generic-utils';
import type { IPagination } from '../utils/graphql-connection-utils';
import { normalizeRelayPagination } from '../utils/graphql-connection-utils';
import { buildOrder, buildWhereComponent } from '../utils/sequelize-utils';

// TODO: minecraftVersion (range & no-range)

const ProjectSearchLuceneConfig = {
  ranges: ['minecraftVersion'],
  fields: ['minecraftVersion', 'modLoader', 'modId', 'modName', 'projectName', 'tags'],
  implicitField: 'projectName',
  fieldMap: {
    minecraftVersion: 'jars.mods.supportedMinecraftVersions',
    modLoader: 'jars.mods.supportedModLoader',
    modId: 'jars.mods.modId',
    modName: 'jars.mods.displayName',
    projectName: 'name',
  },
};

class ProjectSearchService {

  constructor(
    @Inject(SEQUELIZE_PROVIDER)
    private readonly sequelize: Sequelize,
  ) {}

  async searchProjects(
    userQuery: string | null,
    strPagination: IPagination,
  ): Promise<FindByCursorResult<Project>> {
    userQuery = userQuery ? userQuery.trim() : userQuery;
    const pagination = normalizeRelayPagination(strPagination);

    return sequelizeFindByCursor({
      // @ts-expect-error
      model: Project,
      order: [['name', 'ASC']],
      ...pagination,
      where: !userQuery ? undefined : internalProcessSearchProjectsLucene(userQuery, ProjectSearchLuceneConfig),
      findAll: async query => {
        // Model.findAll does nto support DISTINCT ON
        return this.sequelize.query(`
          SELECT DISTINCT ON ("Project"."name", "Project"."internalId") "Project"."internalId",
            "Project"."sourceId",
            "Project"."sourceType",
            "Project"."sourceSlug",
            "Project"."name",
            "Project"."lastSourceEditAt",
            "Project"."versionListUpToDate",
            "Project"."failedFiles",
            "Project"."createdAt",
            "Project"."updatedAt"
          FROM "Projects" AS "Project"
            INNER JOIN "ModJars" AS "jars" ON "Project"."internalId" = "jars"."projectId"
            INNER JOIN "ModVersions" AS "jars->mods" ON "jars"."internalId" = "jars->mods"."jarId"
          WHERE "Project"."sourceSlug" IS NOT NULL
           AND ${buildWhereComponent(query.where, Project, 'Project')}
          ORDER BY ${buildOrder(query.order, 'Project', Project)}
          LIMIT ${query.limit};
        `, {
          logging: console.log,
          type: QueryTypes.SELECT,
          mapToModel: true,
          model: Project,
        });
      },
    });
  }
}

type TLuceneToSqlConfig = {
  fieldMap?: { [luceneField: string]: string },
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

function isNodeRangedTerm(val: any): val is NodeRangedTerm {
  return isNode(val) && 'inclusive' in val;
}

function isNodeTerm(val: any): val is NodeTerm {
  return isNode(val) && 'term' in val;
}

function processLuceneAst(node: AST | Node, config: TLuceneToSqlConfig): WhereOptions {
  if (isNode(node)) {
    return processLuceneNode(node, config);
  }

  if (isLeftOnlyAst(node)) {
    if (node.start) {
      throw new Error('Do not know how to handle node.start');
    }

    return processLuceneAst(node.left, config);
  }

  const op = node.operator;

  switch (op) {
    case 'AND':
    case '<implicit>':
      return {
        [Op.and]: [
          processLuceneAst(node.left, config),
          processLuceneAst(node.right, config),
        ],
      };

    case 'OR':
      return {
        [Op.or]: [
          processLuceneAst(node.left, config),
          processLuceneAst(node.right, config),
        ],
      };

    case 'NOT': // <implicit> NOT
    case 'AND NOT':
      return {
        [Op.and]: [
          processLuceneAst(node.left, config),
          { [Op.not]: processLuceneAst(node.right, config) },
        ],
      };

    case 'OR NOT':
      return {
        [Op.or]: [
          processLuceneAst(node.left, config),
          { [Op.not]: processLuceneAst(node.right, config) },
        ],
      };

    default:
      throw new Error(`unknown operator ${op}`);
  }
}

function processLuceneNode(node: Node, config: TLuceneToSqlConfig): WhereOptions {

  if (node.field === '<implicit>') {
    node.field = config.implicitField;
    if (isNodeTerm(node)) {
      node.term = `*${node.term}*`;
    }
  }

  const sqlField = config?.fieldMap?.[node.field] ?? node.field;

  if (isNodeRangedTerm(node)) {
    const ranges: readonly string[] = config?.ranges ?? EMPTY_ARRAY;

    if (!ranges.includes(node.field)) {
      // !TODO expose to client
      throw new Error(`Field ${JSON.stringify(node.field)} is not a range. Valid ranges: ${JSON.stringify(ranges)}`);
    }

    return {
      [sqlField]: luceneRangedToSql(node),
    };
  }

  return processLuceneTerm(node, config);
}

interface ParenthesizedNodeTerm extends NodeTerm {
  operator: 'AND' | 'OR';
  right: NodeTerm;
  left: NodeTerm;
}

function isOperatorNodeTerm(val: any): val is ParenthesizedNodeTerm {
  return 'operator' in val && val.operator != null;
}

function processLuceneTerm(node: NodeTerm, config: TLuceneToSqlConfig): WhereOptions {
  const fields: readonly string[] = config?.fields ?? EMPTY_ARRAY;
  if (!fields.includes(node.field)) {
    // !TODO expose to client
    throw new Error(`Field ${JSON.stringify(node.field)} is not recognised. Valid fields: ${JSON.stringify(fields)}`);
  }

  const sqlField = config?.fieldMap?.[node.field] ?? node.field;

  return Sequelize.where(
    Sequelize.cast(Sequelize.col(sqlField), 'text'),
    luceneTermToSqlLike(node),
  );
}

function luceneRangedToSql(leaf: NodeRangedTerm): WhereOptions {
  const min = leaf.term_min;
  const max = leaf.term_max;

  let gtOp;
  let ltOp;

  switch (leaf.inclusive) {
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
      throw new Error(`unknown inclusiveness ${leaf.inclusive}`);
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
function luceneTermToSqlLike(node: NodeTerm): OrOperator<any> | AndOperator<any> | WhereOperators {
  if (isOperatorNodeTerm(node)) {
    switch (node.operator) {
      case 'AND':
        return {
          [Op.and]: [
            luceneTermToSqlLike(node.left),
            luceneTermToSqlLike(node.right),
          ],
        };

      case 'OR':
        return {
          [Op.or]: [
            luceneTermToSqlLike(node.left),
            luceneTermToSqlLike(node.right),
          ],
        };

      default:
        throw new Error(`Unknow leaf operator ${node.operator}`);
    }
  }

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

  return { [Op.iLike]: Sequelize.literal(`E'${out}'`) };
}

export { ProjectSearchService };
