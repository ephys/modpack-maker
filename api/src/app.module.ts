import { Module } from '@nestjs/common';
import { join } from 'path';
import { DatabaseModule } from './database/database.module';
import { ModpackModule } from './modpack/modpack.module';
import { GraphQLModule } from '@nestjs/graphql';
import { BullModule } from '@nestjs/bull';
import { ModModule } from './mod/mod.module';
import { ProjectSearchModule } from './project-search/project-search.module';

@Module({
  imports: [
    DatabaseModule,
    ModpackModule,
    ModModule,
    ProjectSearchModule,
    GraphQLModule.forRoot({
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
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
