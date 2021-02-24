import { Sequelize } from 'sequelize-typescript';
import { Modpack } from '../modpack/modpack.entity';
import { Mod } from '../mod/mod.entity';
import { ModVersion } from '../mod/mod-version.entity';
import { CurseforgeProject } from '../mod/curseforge-project.entity';

export const SEQUELIZE_PROVIDER = 'SEQUELIZE';

export const databaseProviders = [
  {
    provide: SEQUELIZE_PROVIDER,
    useFactory: async () => {
      const sequelize = new Sequelize({
        dialect: 'postgres',
        host: 'localhost',
        port: 19132,
        username: 'user',
        password: 'password',
        database: 'db',
        logging: false,
      });

      sequelize.addModels([
        Modpack,
        Mod,
        ModVersion,
        CurseforgeProject,
      ]);

      await sequelize.sync();
      // await sequelize.sync({ force: true });
      return sequelize;
    },
  },
];
