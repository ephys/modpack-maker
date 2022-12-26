import { Inject } from '@nestjs/common';
import cls from 'cls-hooked';
import { Sequelize } from 'sequelize-typescript';
import { ModJar } from '../mod/mod-jar.entity';
import { ModVersion } from '../mod/mod-version.entity';
import ModpackMod from '../modpack-version/modpack-mod.entity';
import { ModpackVersion } from '../modpack-version/modpack-version.entity';
import { Modpack } from '../modpack/modpack.entity';
import { Project } from '../project/project.entity';

export const SEQUELIZE_PROVIDER = 'SEQUELIZE';

export const InjectSequelize = Inject(SEQUELIZE_PROVIDER);

const transactionNamespace = cls.createNamespace('sequelize-transaction');
Sequelize.useCLS(transactionNamespace);

const postgresUrl = process.env.POSTGRES_URL;
if (typeof postgresUrl !== 'string') {
  throw new Error('Provide POSTGRES_URL environment variable');
}

export const databaseProviders = [
  {
    provide: SEQUELIZE_PROVIDER,
    useFactory: async () => {
      const sequelize = new Sequelize(postgresUrl, {
        dialect: 'postgres',
        logging: false,
      });

      sequelize.addModels([
        Modpack,
        ModpackVersion,
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
