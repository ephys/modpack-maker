import { Inject } from '@nestjs/common';
import { Sequelize } from '@sequelize/core';
import { ModJar } from '../mod/mod-jar.entity.js';
import { ModVersion } from '../mod/mod-version.entity.js';
import { Modpack } from '../modpack/modpack.entity.js';
import { ModpackMod } from '../modpack-version/modpack-mod.entity.js';
import { ModpackVersion } from '../modpack-version/modpack-version.entity.js';
import { Project } from '../project/project.entity.js';

export const SEQUELIZE_PROVIDER = 'SEQUELIZE';

export const InjectSequelize = Inject(SEQUELIZE_PROVIDER);

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
        models: [
          Modpack,
          ModpackVersion,
          ModpackMod,
          ModJar,
          ModVersion,
          Project,
        ],
      });

      await sequelize.sync();

      return sequelize;
    },
  },
];
