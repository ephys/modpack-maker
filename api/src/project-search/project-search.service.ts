import * as Lucene from 'lucene';
import 'core-js/es/string/replace-all';
import type { AST, Node, LeftOnlyAST, NodeRangedTerm } from 'lucene';
import { Op, Sequelize, WhereOptions } from 'sequelize';
import { Literal } from 'sequelize/types/lib/utils';
import { ModJar } from '../mod/mod-jar.entity';
import { Project } from '../mod/project.entity';
import type { IPagination } from '../utils/graphql-connection-utils';

class ProjectSearchService {

  async searchProjects(
    query: string | null,
    _pagination: IPagination,
  ) {
    const projects = await Project.findAll({
      where: !query ? undefined : internalProcessSearchProjectsLucene(query, {
        ranges: ['minecraftVersion', 'modLoader', 'modId', 'displayName'],
        fieldMap: {
          minecraftVersion: '$jars.mods.supportedMinecraftVersions$',
          modLoader: '$jars.mods.supportedModLoader$',
          modId: '$jars.mods.modId$',
        },
      }),
      include: [{
        association: Project.associations.jars,
        required: true,
        include: [{
          association: ModJar.associations.mods,
          required: true,
        }],
      }],
    });

    console.log(projects.length);

    // sequelizeFindByCursor({
    //   model: ModVersion,
    //   where
    // })
  }
}

type TLuceneToSqlConfig = {
  fieldMap: { [luceneField: string]: string },
  ranges: string[],
};

export function internalProcessSearchProjectsLucene(query: string, _config?: TLuceneToSqlConfig): WhereOptions {
  const lucene: AST = Lucene.parse(query);

  return processLuceneNode(lucene);
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

function processLuceneNode(node: AST | Node): WhereOptions {
  if (isNode(node)) {
    return processLuceneLeaf(node);
  }

  if (isLeftOnlyAst(node)) {
    if (node.start) {
      throw new Error('Do not know how to handle node.start');
    }

    return processLuceneNode(node.left);
  }

  const op = node.operator;

  switch (op) {
    case 'AND':
    case '<implicit>':
      return {
        [Op.and]: [
          processLuceneNode(node.left),
          processLuceneNode(node.right),
        ],
      };

    case 'OR':
      return {
        [Op.or]: [
          processLuceneNode(node.left),
          processLuceneNode(node.right),
        ],
      };

    case 'NOT': // <implicit> NOT
    case 'AND NOT':
      return {
        [Op.and]: [
          processLuceneNode(node.left),
          { [Op.not]: processLuceneNode(node.right) },
        ],
      };

    case 'OR NOT':
      return {
        [Op.or]: [
          processLuceneNode(node.left),
          { [Op.not]: processLuceneNode(node.right) },
        ],
      };

    default:
      throw new Error(`unknown operator ${op}`);
  }
}

function processLuceneLeaf(leaf: Node): WhereOptions {
  if (isNodeRangedTerm(leaf)) {
    return {
      [leaf.field]: luceneRangedToSql(leaf),
    };
  }

  return {
    [leaf.field]: {
      [Op.iLike]: luceneTermToSqlLike(leaf.term),
    },
  };
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
function luceneTermToSqlLike(term: string): Literal {
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

    // @ts-expect-error
    lastIndex = match.index + previousLen;
  }

  out += term.substring(lastIndex, term.length);

  return Sequelize.literal(`E'${out}'`);
}

export { ProjectSearchService };
