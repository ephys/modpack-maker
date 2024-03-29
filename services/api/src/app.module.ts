import { join } from 'node:path';
import { ApolloDriver } from '@nestjs/apollo';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { GraphQLModule } from './esm-compat/nest-graphql-esm.js';
import { ModModule } from './mod/mod.module.js';
import { ModpackModule } from './modpack/modpack.module.js';
import { ModpackVersionModule } from './modpack-version/modpack-version.module.js';
import { ProjectModule } from './project/project.module.js';
import { ProjectSearchModule } from './project-search/project-search.module.js';

const redisHost = process.env.REDIS_HOST;
if (typeof redisHost !== 'string') {
  throw new Error('Provide REDIS_HOST environment variable');
}

const redisPort = process.env.REDIS_PORT;
if (typeof redisPort !== 'string') {
  throw new Error('Provide REDIS_PORT environment variable');
}

@Module({
  imports: [
    DatabaseModule,
    ModpackModule,
    ModModule,
    ProjectModule,
    ProjectSearchModule,
    ModpackVersionModule,
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), '/../schema.gql'),
      sortSchema: true,
      formatError: error => {
        const code = error.extensions?.code || 'INTERNAL_SERVER_ERROR';

        if (code === 'INTERNAL_SERVER_ERROR') {
          console.error(error.originalError);

          return {
            message: 'Internal Server Error',
            code,
          };
        }

        return {
          message: error.extensions?.exception?.response?.message || error.message,
          code,
          // name: error.extensions?.exception?.name || error.name,
        };
      },
    }),
    BullModule.forRoot({
      redis: {
        host: redisHost,
        port: Number(redisPort),
      },
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
