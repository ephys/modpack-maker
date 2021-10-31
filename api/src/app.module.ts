import { join } from 'path';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { GraphQLModule } from './esm-compat/nest-graphql-esm';
import { ModModule } from './mod/mod.module';
import { ModpackVersionModule } from './modpack-version/modpack-version.module';
import { ModpackModule } from './modpack/modpack.module';
import { ProjectSearchModule } from './project-search/project-search.module';

@Module({
  imports: [
    DatabaseModule,
    ModpackModule,
    ModModule,
    ProjectSearchModule,
    ModpackVersionModule,
    GraphQLModule.forRoot({
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
        host: 'localhost',
        port: 19133,
      },
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
