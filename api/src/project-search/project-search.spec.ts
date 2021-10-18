import { Op, Sequelize } from 'sequelize';
import { internalProcessSearchProjectsLucene } from './project-search.service';

describe('internalProcessSearchProjectsLucene', () => {

  it.todo('interprets invalid queries as simple iLike on projectName');

  it.todo('interprets fieldless nodes as acting on the field projectName');

  it.todo('interprets invalid fields as acting on the field projectName');

  it('processes operatorless queries', () => {
    expect(internalProcessSearchProjectsLucene('modId:feather')).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(`E'feather'`),
      },
    });
  });

  it('processes wildcards', () => {
    expect(internalProcessSearchProjectsLucene(`modId:*feather?`)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(`E'%feather_'`),
      },
    });
  });

  it('escapes wildcards', () => {
    // first \ is to check that "\" is escaped into "\\"
    // other \ are to escape \ at the lucene level
    expect(internalProcessSearchProjectsLucene(String.raw`modId:*\|'%_\{\(\[?`)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'%\\\|\'\%\_\{\(\[_'`),
      },
    });

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\*`)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'*'`),
      },
    });

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\*`)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'\\%'`),
      },
    });

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\*`)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'\\*'`),
      },
    });

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\\*`)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'\\\\%'`),
      },
    });

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\\\*`)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'\\\\*'`),
      },
    });

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\\\\*`)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'\\\\\\%'`),
      },
    });

    expect(internalProcessSearchProjectsLucene(String.raw`modId:\\\\\\\*`)).toEqual({
      modId: {
        [Op.iLike]: Sequelize.literal(String.raw`E'\\\\\\*'`),
      },
    });
  });

  it('supports inclusive ranges', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:[1.16.0 TO 1.16.5]`)).toEqual({
      minecraftVersion: {
        [Op.lte]: '1.16.5',
        [Op.gte]: '1.16.0',
      },
    });
  });

  it('supports left-exclusive ranges', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:[1.16.0 TO 1.16.5}`)).toEqual({
      minecraftVersion: {
        [Op.lt]: '1.16.5',
        [Op.gte]: '1.16.0',
      },
    });
  });

  it('supports right-exclusive ranges', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:{1.16.0 TO 1.16.5]`)).toEqual({
      minecraftVersion: {
        [Op.lte]: '1.16.5',
        [Op.gt]: '1.16.0',
      },
    });
  });

  it('supports exclusive ranges', () => {
    expect(internalProcessSearchProjectsLucene(`minecraftVersion:{1.16.0 TO 1.16.5}`)).toEqual({
      minecraftVersion: {
        [Op.lt]: '1.16.5',
        [Op.gt]: '1.16.0',
      },
    });
  });

  it('supports AND', () => {
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather AND minecraftVersion:[1.16.0 TO 1.16.5]`)).toEqual({
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
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather OR minecraftVersion:[1.16.0 TO 1.16.5]`)).toEqual({
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
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather displayName:abc`)).toEqual({
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
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather NOT displayName:abc`)).toEqual({
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
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather AND NOT displayName:abc`)).toEqual({
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
    expect(internalProcessSearchProjectsLucene(`modId:magic_feather OR NOT displayName:abc`)).toEqual({
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
});
