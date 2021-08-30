import type { Type } from '@nestjs/common';
import { Field, ObjectType, Int, Args } from '@nestjs/graphql';

interface IEdgeType<T> {
  cursor: string;
  node: T;
}

@ObjectType()
class PageInfo {
  @Field()
  hasPreviousPage: boolean;

  @Field()
  hasNextPage: boolean;

  @Field(() => String, { nullable: true })
  startCursor: String | null;

  @Field(() => String, { nullable: true })
  endCursor: String | null;
}

interface IConnectionType<T> {
  edges: Array<IEdgeType<T>>;
  nodes: T[];
  totalCount: number;
  pageInfo: PageInfo;
}

type IPagination = {
  first?: number | null,
  last?: number | null,
  before?: string | null,
  after?: string | null,
};

function Connection<T>(classRef: Type<T>): Type<IConnectionType<T>> {
  @ObjectType(`${classRef.name}Edge`)
  abstract class EdgeType {
    @Field(() => String)
    cursor: string;

    @Field(() => classRef)
    node: T;
  }

  @ObjectType(`${classRef.name}Connection`)
  abstract class PaginatedType implements IConnectionType<T> {
    @Field(() => [EdgeType], { nullable: true })
    edges: EdgeType[];

    @Field(() => [classRef], { nullable: true })
    nodes: T[];

    @Field(() => Int)
    totalCount: number;

    @Field()
    pageInfo: PageInfo;
  }

  return PaginatedType as Type<IConnectionType<T>>;
}

function First() {
  return Args('first', { nullable: true, type: () => Int });
}

function Last() {
  return Args('last', { nullable: true, type: () => Int });
}

function Before() {
  return Args('before', { nullable: true, type: () => String });
}

function After() {
  return Args('after', { nullable: true, type: () => String });
}

export { Connection, IConnectionType, IEdgeType, PageInfo, First, Last, Before, After, IPagination };
