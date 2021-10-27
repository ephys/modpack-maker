import type { Node } from 'lucene';
import { Op, Sequelize } from 'sequelize';
import { and, contains, iLike, not, or } from '../utils/sequelize-utils';
import type { TLuceneToSqlConfig } from './project-search.service';
import { internalProcessSearchProjectsLucene, isNodeTerm } from './project-search.service';

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
    expect(internalProcessSearchProjectsLucene('modId:feather', LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('modId'), 'text'),
        iLike(Sequelize.literal(`E'feather'`)),
      ),
    );
  });

  it('processes wildcards', () => {
    expect(internalProcessSearchProjectsLucene(`modId:*feather?`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('modId'), 'text'),
        iLike(Sequelize.literal(`E'%feather_'`)),
      ),
    );
  });

  it('escapes wildcards', () => {
    // first \ is to check that "\" is escaped into "\\"
    // other \ are to escape \ at the lucene level
    expect(internalProcessSearchProjectsLucene(String.raw`modId:*\|'%_\{\(\[?`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('modId'), 'text'),
        iLike(Sequelize.literal(String.raw`E'%\\\|\'\%\_\{\(\[_'`)),
      ),
    );

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\*`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('modId'), 'text'),
        iLike(Sequelize.literal(String.raw`E'*'`)),
      ),
    );

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\*`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('modId'), 'text'),
        iLike(Sequelize.literal(String.raw`E'\\%'`)),
      ),
    );

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\*`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('modId'), 'text'),
        iLike(Sequelize.literal(String.raw`E'\\*'`)),
      ),
    );

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\\*`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('modId'), 'text'),
        iLike(Sequelize.literal(String.raw`E'\\\\%'`)),
      ),
    );

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\\\*`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('modId'), 'text'),
        iLike(Sequelize.literal(String.raw`E'\\\\*'`)),
      ),
    );

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\\\\*`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('modId'), 'text'),
        iLike(Sequelize.literal(String.raw`E'\\\\\\%'`)),
      ),
    );

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\\\\\*`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('modId'), 'text'),
        iLike(Sequelize.literal(String.raw`E'\\\\\\*'`)),
      ),
    );
  });

  it('supports inclusive ranges', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:[1.16.0 TO 1.16.5]`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('minecraftVersion'), 'text'),
        {
          [Op.lte]: '1.16.5',
          [Op.gte]: '1.16.0',
        },
      ),
    );
  });

  it('supports left-exclusive ranges', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:[1.16.0 TO 1.16.5}`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('minecraftVersion'), 'text'),
        {
          [Op.lt]: '1.16.5',
          [Op.gte]: '1.16.0',
        },
      ),
    );
  });

  it('supports right-exclusive ranges', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:{1.16.0 TO 1.16.5]`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('minecraftVersion'), 'text'),
        {
          [Op.lte]: '1.16.5',
          [Op.gt]: '1.16.0',
        },
      ),
    );
  });

  it('supports exclusive ranges', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:{1.16.0 TO 1.16.5}`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('minecraftVersion'), 'text'),
        {
          [Op.lt]: '1.16.5',
          [Op.gt]: '1.16.0',
        },
      ),
    );
  });

  it('supports AND', () => {
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather AND minecraftVersion:[1.16.0 TO 1.16.5]`, LuceneConfig)).toEqual(
      and(
        Sequelize.where(
          Sequelize.cast(Sequelize.col('modId'), 'text'),
          iLike(Sequelize.literal(`E'magic\\_feather'`)),
        ),
        Sequelize.where(
          Sequelize.cast(Sequelize.col('minecraftVersion'), 'text'),
          {
            [Op.gte]: '1.16.0',
            [Op.lte]: '1.16.5',
          },
        ),
      ),
    );
  });

  it('supports OR', () => {
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather OR minecraftVersion:[1.16.0 TO 1.16.5]`, LuceneConfig)).toEqual(
      or(
        Sequelize.where(
          Sequelize.cast(Sequelize.col('modId'), 'text'),
          iLike(Sequelize.literal(`E'magic\\_feather'`)),
        ),
        Sequelize.where(
          Sequelize.cast(Sequelize.col('minecraftVersion'), 'text'),
          {
            [Op.gte]: '1.16.0',
            [Op.lte]: '1.16.5',
          },
        ),
      ),
    );
  });

  it('<implicit> operator is AND', () => {
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather displayName:abc`, LuceneConfig)).toEqual(
      and(
        Sequelize.where(
          Sequelize.cast(Sequelize.col('modId'), 'text'),
          iLike(Sequelize.literal(`E'magic\\_feather'`)),
        ),
        Sequelize.where(
          Sequelize.cast(Sequelize.col('displayName'), 'text'),
          iLike(Sequelize.literal(`E'abc'`)),
        ),
      ),
    );
  });

  it('supports <implicit> NOT (as AND NOT)', () => {
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather NOT displayName:abc`, LuceneConfig)).toEqual(
      and(
        Sequelize.where(
          Sequelize.cast(Sequelize.col('modId'), 'text'),
          iLike(Sequelize.literal(`E'magic\\_feather'`)),
        ),
        not(Sequelize.where(
          Sequelize.cast(Sequelize.col('displayName'), 'text'),
          iLike(Sequelize.literal(`E'abc'`)),
        )),
      ),
    );
  });

  it('supports AND NOT', () => {
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather AND NOT displayName:abc`, LuceneConfig)).toEqual(
      and(
        Sequelize.where(
          Sequelize.cast(Sequelize.col('modId'), 'text'),
          iLike(Sequelize.literal(`E'magic\\_feather'`)),
        ),
        not(Sequelize.where(
          Sequelize.cast(Sequelize.col('displayName'), 'text'),
          iLike(Sequelize.literal(`E'abc'`)),
        )),
      ),
    );
  });

  it('supports OR NOT', () => {
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather OR NOT displayName:abc`, LuceneConfig)).toEqual(
      or(
        Sequelize.where(
          Sequelize.cast(Sequelize.col('modId'), 'text'),
          iLike(Sequelize.literal(`E'magic\\_feather'`)),
        ),
        not(Sequelize.where(
          Sequelize.cast(Sequelize.col('displayName'), 'text'),
          iLike(Sequelize.literal(`E'abc'`)),
        )),
      ),
    );
  });

  it('supports field:(x OR y)', () => {
    expect(internalProcessSearchProjectsLucene(`modId:(a OR b)`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('modId'), 'text'),
        or(
          iLike(Sequelize.literal(`E'a'`)),
          iLike(Sequelize.literal(`E'b'`)),
        ),
      ),
    );
  });

  it('supports field:(x OR y OR z AND a)', () => {
    expect(internalProcessSearchProjectsLucene(`modId:(x OR y OR z AND a)`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('modId'), 'text'),
        or(
          iLike(Sequelize.literal(`E'x'`)),
          or(
            iLike(Sequelize.literal(`E'y'`)),
            and(
              iLike(Sequelize.literal(`E'z'`)),
              iLike(Sequelize.literal(`E'a'`)),
            ),
          ),
        ),
      ),
    );
  });

  it('supports field:([x TO y] OR z)', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:([x TO y] OR z)`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('minecraftVersion'), 'text'),
        or(
          { [Op.gte]: 'x', [Op.lte]: 'y' },
          iLike(Sequelize.literal(`E'z'`)),
        ),
      ),
    );
  });

  it('supports field:([x TO y])', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:([x TO y])`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('minecraftVersion'), 'text'),
        { [Op.gte]: 'x', [Op.lte]: 'y' },
      ),
    );
  });

  it('supports field:(x)', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:(z)`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('minecraftVersion'), 'text'),
        iLike(Sequelize.literal(`E'z'`)),
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
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:([x TO y] OR z)`, config)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('minecraftVersion'), 'text[]'),
        or(
          contains('ranged'),
          contains('term'),
        ),
      ),
    );
  });

  it('supports "NOT field:x"', () => {
    expect(internalProcessSearchProjectsLucene(`NOT displayName:z`, LuceneConfig)).toEqual(
      not(
        Sequelize.where(
          Sequelize.cast(Sequelize.col('displayName'), 'text'),
          iLike(Sequelize.literal(`E'z'`)),
        ),
      ),
    );
  });

  it('supports "field:(NOT x)"', () => {
    expect(internalProcessSearchProjectsLucene(`displayName:(NOT z)`, LuceneConfig)).toEqual(
      Sequelize.where(
        Sequelize.cast(Sequelize.col('displayName'), 'text'),
        { [Op.not]: iLike(Sequelize.literal(`E'z'`)) },
      ),
    );
  });

  it('supports "NOT (field:x OR field:y)"', () => {
    expect(internalProcessSearchProjectsLucene(`NOT (displayName:x OR displayName:y)`, LuceneConfig)).toEqual(
      not(
        or(
          Sequelize.where(
            Sequelize.cast(Sequelize.col('displayName'), 'text'),
            iLike(Sequelize.literal(`E'x'`)),
          ),
          Sequelize.where(
            Sequelize.cast(Sequelize.col('displayName'), 'text'),
            iLike(Sequelize.literal(`E'y'`)),
          ),
        ),
      ),
    );
  });

  it('supports "NOT (field:x OR field:y OR NOT(field:a AND field:b))"', () => {
    expect(internalProcessSearchProjectsLucene(`NOT (displayName:x OR displayName:y OR NOT(displayName:a AND displayName:b))`, LuceneConfig)).toEqual(
      not(
        or(
          Sequelize.where(
            Sequelize.cast(Sequelize.col('displayName'), 'text'),
            iLike(Sequelize.literal(`E'x'`)),
          ),
          Sequelize.where(
            Sequelize.cast(Sequelize.col('displayName'), 'text'),
            iLike(Sequelize.literal(`E'y'`)),
          ),
        ),
      ),
    );
  });
});
