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
});
