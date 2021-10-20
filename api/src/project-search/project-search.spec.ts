import { Op, Sequelize } from 'sequelize';
import { and, iLike, or } from '../utils/sequelize-utils';
import { internalProcessSearchProjectsLucene } from './project-search.service';

// TODO: test fieldMap

const LuceneConfig = {
  ranges: ['minecraftVersion'],
  fields: ['minecraftVersion', 'modId', 'displayName'],
};

describe('internalProcessSearchProjectsLucene', () => {

  it.todo('interprets invalid queries as simple iLike on projectName');

  it.todo('interprets fieldless nodes as acting on the field projectName');

  it.todo('interprets invalid fields as acting on the field projectName');

  it('processes operatorless queries', () => {
    expect(internalProcessSearchProjectsLucene('modId:feather', LuceneConfig)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(`E'feather'`),
      },
    });
  });

  it('processes wildcards', () => {
    expect(internalProcessSearchProjectsLucene(`modId:*feather?`, LuceneConfig)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(`E'%feather_'`),
      },
    });
  });

  it('escapes wildcards', () => {
    // first \ is to check that "\" is escaped into "\\"
    // other \ are to escape \ at the lucene level
    expect(internalProcessSearchProjectsLucene(String.raw`modId:*\|'%_\{\(\[?`, LuceneConfig)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'%\\\|\'\%\_\{\(\[_'`),
      },
    });

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\*`, LuceneConfig)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'*'`),
      },
    });

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\*`, LuceneConfig)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'\\%'`),
      },
    });

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\*`, LuceneConfig)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'\\*'`),
      },
    });

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\\*`, LuceneConfig)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'\\\\%'`),
      },
    });

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\\\*`, LuceneConfig)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'\\\\*'`),
      },
    });

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\\\\*`, LuceneConfig)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'\\\\\\%'`),
      },
    });

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\\\\\*`, LuceneConfig)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'\\\\\\*'`),
      },
    });
  });

  it('supports inclusive ranges', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:[1.16.0 TO 1.16.5]`, LuceneConfig)).toEqual({
      minecraftVersion: {
        [Op.lte]: '1.16.5',
        [Op.gte]: '1.16.0',
      },
    });
  });

  it('supports left-exclusive ranges', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:[1.16.0 TO 1.16.5}`, LuceneConfig)).toEqual({
      minecraftVersion: {
        [Op.lt]: '1.16.5',
        [Op.gte]: '1.16.0',
      },
    });
  });

  it('supports right-exclusive ranges', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:{1.16.0 TO 1.16.5]`, LuceneConfig)).toEqual({
      minecraftVersion: {
        [Op.lte]: '1.16.5',
        [Op.gt]: '1.16.0',
      },
    });
  });

  it('supports exclusive ranges', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:{1.16.0 TO 1.16.5}`, LuceneConfig)).toEqual({
      minecraftVersion: {
        [Op.lt]: '1.16.5',
        [Op.gt]: '1.16.0',
      },
    });
  });

  it('supports AND', () => {
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather AND minecraftVersion:[1.16.0 TO 1.16.5]`, LuceneConfig)).toEqual({
      [Op.and]: [{
        modId: {
          [Op.iLike]: Sequelize.literal(`E'magic\\_feather'`),
        },
      },
      {
        minecraftVersion: {
          [Op.gte]: '1.16.0',
          [Op.lte]: '1.16.5',
        },
      }],
    });
  });

  it('supports OR', () => {
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather OR minecraftVersion:[1.16.0 TO 1.16.5]`, LuceneConfig)).toEqual({
      [Op.or]: [{
        modId: {
          [Op.iLike]: Sequelize.literal(`E'magic\\_feather'`),
        },
      },
      {
        minecraftVersion: {
          [Op.gte]: '1.16.0',
          [Op.lte]: '1.16.5',
        },
      }],
    });
  });

  it('<implicit> operator is AND', () => {
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather displayName:abc`, LuceneConfig)).toEqual({
      [Op.and]: [{
        modId: {
          [Op.iLike]: Sequelize.literal(`E'magic\\_feather'`),
        },
      },
      {
        displayName: {
          [Op.iLike]: Sequelize.literal(`E'abc'`),
        },
      }],
    });
  });

  it('supports <implicit> NOT (as AND NOT)', () => {
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather NOT displayName:abc`, LuceneConfig)).toEqual({
      [Op.and]: [{
        modId: {
          [Op.iLike]: Sequelize.literal(`E'magic\\_feather'`),
        },
      },
      {
        [Op.not]: {
          displayName: {
            [Op.iLike]: Sequelize.literal(`E'abc'`),
          },
        },
      }],
    });
  });

  it('supports AND NOT', () => {
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather AND NOT displayName:abc`, LuceneConfig)).toEqual({
      [Op.and]: [{
        modId: {
          [Op.iLike]: Sequelize.literal(`E'magic\\_feather'`),
        },
      },
      {
        [Op.not]: {
          displayName: {
            [Op.iLike]: Sequelize.literal(`E'abc'`),
          },
        },
      }],
    });
  });

  it('supports OR NOT', () => {
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather OR NOT displayName:abc`, LuceneConfig)).toEqual({
      [Op.or]: [{
        modId: {
          [Op.iLike]: Sequelize.literal(`E'magic\\_feather'`),
        },
      },
      {
        [Op.not]: {
          displayName: {
            [Op.iLike]: Sequelize.literal(`E'abc'`),
          },
        },
      }],
    });
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
});
