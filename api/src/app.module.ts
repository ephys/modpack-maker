import { Module } from '@nestjs/common';
import { join } from 'path';
import { DatabaseModule } from './database/database.module';
import { ModpackModule } from './modpack/modpack.module';
import { GraphQLModule } from '@nestjs/graphql';

@Module({
  imports: [
    DatabaseModule,
    ModpackModule,
    GraphQLModule.forRoot({
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}


