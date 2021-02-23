import { Sequelize } from 'sequelize-typescript';
import { Modpack } from '../modpack/modpack.entity';

export const databaseProviders = [
  {
    provide: 'SEQUELIZE',
    useFactory: async () => {
      const sequelize = new Sequelize({
        dialect: 'postgres',
        host: 'localhost',
        port: 19132,
        username: 'user',
        password: 'password',
        database: 'db',
      });

      sequelize.addModels([
        Modpack,
      ]);

      await sequelize.sync();
      // await sequelize.sync({ force: true });
      return sequelize;
    },
  },
];
