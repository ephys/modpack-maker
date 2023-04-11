import NestGraphqlPkg from '@nestjs/graphql';

/**
 * Temporary Module until @nestjs/graphql supports ESM out of the box.
 */

/* eslint-disable max-len */

const { Field, ID, Int, ObjectType, ResolveField, Parent, Resolver, registerEnumType, InputType, Mutation, Args, Query, ArgsType, GraphQLModule } = NestGraphqlPkg;

export { Field, ID, Int, ObjectType, ResolveField, Parent, Resolver, registerEnumType, InputType, Mutation, Args, Query, ArgsType, GraphQLModule };
