import * as Lucene from 'lucene';
import type { AST, LeftOnlyAST, Node, NodeField, NodeRangedTerm, NodeTerm, Operator } from 'lucene';
import type { AndOperator, OrOperator, WhereOperators, WhereOptions } from 'sequelize';
import SequelizePkg from 'sequelize';
import { EMPTY_ARRAY } from '../../../common/utils';
import { Op } from '../esm-compat/sequelize-esm';
import { iLike, not } from './sequelize-utils';

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

export function luceneToSequelize(query: string, config: TLuceneToSqlConfig): WhereOptions {
  query = query.trim();
  if (!query) {
    return {};
  }

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
