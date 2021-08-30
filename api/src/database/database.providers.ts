import { Sequelize } from 'sequelize-typescript';
import { Modpack } from '../modpack/modpack.entity';
import { ModVersion } from '../mod/mod-version.entity';
import { Project } from '../mod/project.entity';
import ModpackMod from '../modpack/modpack-mod.entity';
import { Inject } from '@nestjs/common';
import { ModJar } from '../mod/mod-jar.entity';

export const SEQUELIZE_PROVIDER = 'SEQUELIZE';

export const InjectSequelize = Inject(SEQUELIZE_PROVIDER);

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
        ModpackMod,
        ModJar,
        ModVersion,
        Project,
      ]);

      await sequelize.sync();
      return sequelize;
    },
  },
];
