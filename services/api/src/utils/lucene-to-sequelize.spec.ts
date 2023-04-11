import { Op, and, or, sql } from '@sequelize/core';
import type { Node } from 'lucene';
import type { TLuceneToSqlConfig } from './lucene-to-sequelize.js';
import { isNodeTerm, luceneToSequelize } from './lucene-to-sequelize.js';
import { contains, iLike, not } from './sequelize-utils.js';

const LuceneConfig: TLuceneToSqlConfig = {
  ranges: ['minecraftVersion'],
  fields: ['minecraftVersion', 'modId', 'displayName'],
  implicitField: 'displayName',
};

describe('internalProcessSearchProjectsLucene', () => {

  // TODO: test fieldMap

  it.todo('interprets invalid queries as simple iLike on projectName');

  it.todo('interprets fieldless nodes as acting on the field projectName');

  it.todo('interprets invalid fields as acting on the field projectName');

  it('processes operatorless queries', () => {
    expect(luceneToSequelize('modId:feather', LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('modId'), 'text'),
        iLike(sql.literal(`E'feather'`)),
      ),
    );
  });

  it('processes wildcards', () => {
    expect(luceneToSequelize(`modId:*feather?`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('modId'), 'text'),
        iLike(sql.literal(`E'%feather_'`)),
      ),
    );
  });

  it('escapes wildcards', () => {
    // first \ is to check that "\" is escaped into "\\"
    // other \ are to escape \ at the lucene level
    expect(luceneToSequelize(String.raw`modId:*\|'%_\{\(\[?`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('modId'), 'text'),
        iLike(sql.literal(String.raw`E'%\\\|\'\%\_\{\(\[_'`)),
      ),
    );

    expect(luceneToSequelize(String.raw`modId:\*`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('modId'), 'text'),
        iLike(sql.literal(String.raw`E'*'`)),
      ),
    );

    expect(luceneToSequelize(String.raw`modId:\\*`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('modId'), 'text'),
        iLike(sql.literal(String.raw`E'\\%'`)),
      ),
    );

    expect(luceneToSequelize(String.raw`modId:\\\*`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('modId'), 'text'),
        iLike(sql.literal(String.raw`E'\\*'`)),
      ),
    );

    expect(luceneToSequelize(String.raw`modId:\\\\*`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('modId'), 'text'),
        iLike(sql.literal(String.raw`E'\\\\%'`)),
      ),
    );

    expect(luceneToSequelize(String.raw`modId:\\\\\*`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('modId'), 'text'),
        iLike(sql.literal(String.raw`E'\\\\*'`)),
      ),
    );

    expect(luceneToSequelize(String.raw`modId:\\\\\\*`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('modId'), 'text'),
        iLike(sql.literal(String.raw`E'\\\\\\%'`)),
      ),
    );

    expect(luceneToSequelize(String.raw`modId:\\\\\\\*`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('modId'), 'text'),
        iLike(sql.literal(String.raw`E'\\\\\\*'`)),
      ),
    );
  });

  it('supports inclusive ranges', () => {
    expect(luceneToSequelize(`minecraftVersion:[1.16.0 TO 1.16.5]`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('minecraftVersion'), 'text'),
        {
          [Op.lte]: '1.16.5',
          [Op.gte]: '1.16.0',
        },
      ),
    );
  });

  it('supports left-exclusive ranges', () => {
    expect(luceneToSequelize(`minecraftVersion:[1.16.0 TO 1.16.5}`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('minecraftVersion'), 'text'),
        {
          [Op.lt]: '1.16.5',
          [Op.gte]: '1.16.0',
        },
      ),
    );
  });

  it('supports right-exclusive ranges', () => {
    expect(luceneToSequelize(`minecraftVersion:{1.16.0 TO 1.16.5]`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('minecraftVersion'), 'text'),
        {
          [Op.lte]: '1.16.5',
          [Op.gt]: '1.16.0',
        },
      ),
    );
  });

  it('supports exclusive ranges', () => {
    expect(luceneToSequelize(`minecraftVersion:{1.16.0 TO 1.16.5}`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('minecraftVersion'), 'text'),
        {
          [Op.lt]: '1.16.5',
          [Op.gt]: '1.16.0',
        },
      ),
    );
  });

  it('supports AND', () => {
    expect(luceneToSequelize(`modId:magic_feather AND minecraftVersion:[1.16.0 TO 1.16.5]`, LuceneConfig)).toEqual(
      and(
        sql.where(
          sql.cast(sql.col('modId'), 'text'),
          iLike(sql.literal(`E'magic\\_feather'`)),
        ),
        sql.where(
          sql.cast(sql.col('minecraftVersion'), 'text'),
          {
            [Op.gte]: '1.16.0',
            [Op.lte]: '1.16.5',
          },
        ),
      ),
    );
  });

  it('supports OR', () => {
    expect(luceneToSequelize(`modId:magic_feather OR minecraftVersion:[1.16.0 TO 1.16.5]`, LuceneConfig)).toEqual(
      or(
        sql.where(
          sql.cast(sql.col('modId'), 'text'),
          iLike(sql.literal(`E'magic\\_feather'`)),
        ),
        sql.where(
          sql.cast(sql.col('minecraftVersion'), 'text'),
          {
            [Op.gte]: '1.16.0',
            [Op.lte]: '1.16.5',
          },
        ),
      ),
    );
  });

  it('<implicit> operator is AND', () => {
    expect(luceneToSequelize(`modId:magic_feather displayName:abc`, LuceneConfig)).toEqual(
      and(
        sql.where(
          sql.cast(sql.col('modId'), 'text'),
          iLike(sql.literal(`E'magic\\_feather'`)),
        ),
        sql.where(
          sql.cast(sql.col('displayName'), 'text'),
          iLike(sql.literal(`E'abc'`)),
        ),
      ),
    );
  });

  it('supports <implicit> NOT (as AND NOT)', () => {
    expect(luceneToSequelize(`modId:magic_feather NOT displayName:abc`, LuceneConfig)).toEqual(
      and(
        sql.where(
          sql.cast(sql.col('modId'), 'text'),
          iLike(sql.literal(`E'magic\\_feather'`)),
        ),
        not(sql.where(
          sql.cast(sql.col('displayName'), 'text'),
          iLike(sql.literal(`E'abc'`)),
        )),
      ),
    );
  });

  it('supports AND NOT', () => {
    expect(luceneToSequelize(`modId:magic_feather AND NOT displayName:abc`, LuceneConfig)).toEqual(
      and(
        sql.where(
          sql.cast(sql.col('modId'), 'text'),
          iLike(sql.literal(`E'magic\\_feather'`)),
        ),
        not(sql.where(
          sql.cast(sql.col('displayName'), 'text'),
          iLike(sql.literal(`E'abc'`)),
        )),
      ),
    );
  });

  it('supports OR NOT', () => {
    expect(luceneToSequelize(`modId:magic_feather OR NOT displayName:abc`, LuceneConfig)).toEqual(
      or(
        sql.where(
          sql.cast(sql.col('modId'), 'text'),
          iLike(sql.literal(`E'magic\\_feather'`)),
        ),
        not(sql.where(
          sql.cast(sql.col('displayName'), 'text'),
          iLike(sql.literal(`E'abc'`)),
        )),
      ),
    );
  });

  it('supports field:(x OR y)', () => {
    expect(luceneToSequelize(`modId:(a OR b)`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('modId'), 'text'),
        or(
          iLike(sql.literal(`E'a'`)),
          iLike(sql.literal(`E'b'`)),
        ),
      ),
    );
  });

  it('supports field:(x OR y OR z AND a)', () => {
    expect(luceneToSequelize(`modId:(x OR y OR z AND a)`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('modId'), 'text'),
        or(
          iLike(sql.literal(`E'x'`)),
          or(
            iLike(sql.literal(`E'y'`)),
            and(
              iLike(sql.literal(`E'z'`)),
              iLike(sql.literal(`E'a'`)),
            ),
          ),
        ),
      ),
    );
  });

  it('supports field:([x TO y] OR z)', () => {
    expect(luceneToSequelize(`minecraftVersion:([x TO y] OR z)`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('minecraftVersion'), 'text'),
        or(
          { [Op.gte]: 'x', [Op.lte]: 'y' },
          iLike(sql.literal(`E'z'`)),
        ),
      ),
    );
  });

  it('supports field:([x TO y])', () => {
    expect(luceneToSequelize(`minecraftVersion:([x TO y])`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('minecraftVersion'), 'text'),
        { [Op.gte]: 'x', [Op.lte]: 'y' },
      ),
    );
  });

  it('supports field:(x)', () => {
    expect(luceneToSequelize(`minecraftVersion:(z)`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('minecraftVersion'), 'text'),
        iLike(sql.literal(`E'z'`)),
      ),
    );
  });

  it('supports custom builders (eg. for arrays)', () => {
    const config: TLuceneToSqlConfig = {
      ...LuceneConfig,
      cast: {
        minecraftVersion: 'text[]',
      },
      whereBuilder: {
        minecraftVersion: (node: Node) => {
          if (isNodeTerm(node)) {
            return contains('term');
          }

          return contains('ranged');
        },
      },
    };
    expect(luceneToSequelize(`minecraftVersion:([x TO y] OR z)`, config)).toEqual(
      sql.where(
        sql.cast(sql.col('minecraftVersion'), 'text[]'),
        or(
          contains('ranged'),
          contains('term'),
        ),
      ),
    );
  });

  it('supports "NOT field:x"', () => {
    expect(luceneToSequelize(`NOT displayName:z`, LuceneConfig)).toEqual(
      not(
        sql.where(
          sql.cast(sql.col('displayName'), 'text'),
          iLike(sql.literal(`E'z'`)),
        ),
      ),
    );
  });

  it('supports "field:(NOT x)"', () => {
    expect(luceneToSequelize(`displayName:(NOT z)`, LuceneConfig)).toEqual(
      sql.where(
        sql.cast(sql.col('displayName'), 'text'),
        { [Op.not]: iLike(sql.literal(`E'z'`)) },
      ),
    );
  });

  it('supports "NOT (field:x OR field:y)"', () => {
    expect(luceneToSequelize(`NOT (displayName:x OR displayName:y)`, LuceneConfig)).toEqual(
      not(
        or(
          sql.where(
            sql.cast(sql.col('displayName'), 'text'),
            iLike(sql.literal(`E'x'`)),
          ),
          sql.where(
            sql.cast(sql.col('displayName'), 'text'),
            iLike(sql.literal(`E'y'`)),
          ),
        ),
      ),
    );
  });

  it('supports "NOT (field:x OR field:y OR NOT(field:a AND field:b))"', () => {
    expect(luceneToSequelize(`NOT (displayName:x OR displayName:y OR NOT(displayName:a AND displayName:b))`, LuceneConfig)).toEqual(
      not(
        or(
          sql.where(
            sql.cast(sql.col('displayName'), 'text'),
            iLike(sql.literal(`E'x'`)),
          ),
          sql.where(
            sql.cast(sql.col('displayName'), 'text'),
            iLike(sql.literal(`E'y'`)),
          ),
        ),
      ),
    );
  });
});
