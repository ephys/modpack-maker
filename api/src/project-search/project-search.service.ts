import * as Lucene from 'lucene';
import 'core-js/es/string/replace-all';
import { Op, Sequelize, WhereOptions } from 'sequelize';
import { Literal } from 'sequelize/types/lib/utils';
import { ModJar } from '../mod/mod-jar.entity';
import { Project } from '../mod/project.entity';
import type { IPagination } from '../utils/graphql-connection-utils';

class ProjectSearchService {

  async searchProjects(
    query: String | null,
    _pagination: IPagination,
  ) {
    const projects = await Project.findAll({
      where: internalProcessSearchProjectsLucene(query),
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

export function internalProcessSearchProjectsLucene(query): WhereOptions {
  const lucene = Lucene.parse(query);

  return processLuceneNode(lucene);
}

function processLuceneNode(node): WhereOptions {
  if (node.field) {
    return processLuceneLeaf(node);
  }

  const op = node.operator;
  if (!op) {
    return processLuceneNode(node.left);
  }

  console.log(node);

  throw new Error('NYI');

  // ModVersion.findAll()
  // modId
  // displayName
  // supportedMinecraftVersions
  // supportedModLoader

  /*
  - **modId** - returns only projects that have at least one jar containing this modId
- **modName** - returns only projects that have at least one jar containing one mod that matches modName
- **minecraftVersion** - returns only projects that have at least one jar containing one mod that supports minecraftVersion
- **modLoader** - returns only projects that have at least one jar containing one mod that uses this modLoader
   */
}

function processLuceneLeaf(leaf): WhereOptions {
  // console.log(leaf);

  return {
    [leaf.field]: {
      [Op.iLike]: luceneTermToSqlLike(leaf.term),
    },
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
