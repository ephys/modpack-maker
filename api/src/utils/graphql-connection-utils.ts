import { FindByCursorResult } from '@ephys/sequelize-cursor-pagination';
import type { Type } from '@nestjs/common';
import { Field, ObjectType, Int, Args } from '@nestjs/graphql';
import { MaybePromise } from '../../../common/typing-utils';
import { lastItem } from './generic-utils';

interface IEdgeType<T> {
  cursor: string;
  node: T;
}

@ObjectType()
class PageInfo {
  @Field(() => Boolean)
  hasPreviousPage: MaybePromise<boolean>;

  @Field(() => Boolean)
  hasNextPage: MaybePromise<boolean>;

  @Field(() => String, { nullable: true })
  startCursor: MaybePromise<String | null>;

  @Field(() => String, { nullable: true })
  endCursor: MaybePromise<String | null>;
}

interface IConnectionType<T> {
  edges: MaybePromise<Array<IEdgeType<T>>>;
  nodes: MaybePromise<T[]>;
  totalCount: MaybePromise<number>;
  pageInfo: MaybePromise<PageInfo>;
}

type IPagination = {
  first?: number | null,
  last?: number | null,
  before?: string | null,
  after?: string | null,
};

export function normalizeRelayPagination(pagination: IPagination, defaultReturnCount: number = 20): IPagination {
  return {
    ...pagination,
    first: pagination.first ?? (pagination.last == null ? defaultReturnCount : null),
  };
}

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

type TOpts<T> = {
  totalCount?(): MaybePromise<number>,
  getCursor?(node: T, result: FindByCursorResult<T>): string,
};

function defaultGetCursor<T>(node: T, result: FindByCursorResult<T>): string {
  const out = Object.create(null);

  for (const key of result.cursorKeys) {
    const value = node[key];

    if (value === undefined) {
      throw new Error(`node is missing cursor key ${key}`);
    }

    out[key] = node[key];
  }

  return Buffer.from(JSON.stringify(out)).toString('base64');
}

export function sequelizeCursorToConnection<T>(
  lazyCursorResult: (() => MaybePromise<FindByCursorResult<T>>),
  opts?: TOpts<T>,
): IConnectionType<T> {
  const getCursor = opts?.getCursor ?? defaultGetCursor;

  let _cursorResult: MaybePromise<FindByCursorResult<T>> | undefined;
  const getCursorResult = async (): Promise<FindByCursorResult<T>> => {
    if (_cursorResult == null) {
      _cursorResult = lazyCursorResult();
    }

    return _cursorResult;
  };

  return {
    get nodes() {
      return getCursorResult().then(res => res.nodes);
    },
    get edges() {
      return getCursorResult().then(res => res.nodes.map(node => {
        return {
          node,
          cursor: getCursor(node, res),
        };
      }));
    },
    get totalCount(): MaybePromise<number> {
      const totalCount = opts?.totalCount;
      if (totalCount == null) {
        // !TODO: expose this error to front
        throw new Error('totalCount is not implemented on this Connection');
      }

      return totalCount();
    },
    get pageInfo(): PageInfo {
      const cursorResultPromise = getCursorResult();

      return {
        startCursor: cursorResultPromise.then(res => {
          const firstNode = res.nodes[0];

          return firstNode != null ? getCursor(firstNode, res) : null;
        }),
        endCursor: cursorResultPromise.then(res => {
          const lastNode = lastItem(res.nodes);

          return lastNode != null ? getCursor(lastNode, res) : null;
        }),
        get hasNextPage(): MaybePromise<boolean> {
          return cursorResultPromise.then(result => result.hasNextPage());
        },
        get hasPreviousPage(): MaybePromise<boolean> {
          return cursorResultPromise.then(result => result.hasPreviousPage());
        },
      };
    },
  };
}

export const EMPTY_CONNECTION: IConnectionType<any> = Object.freeze({
  nodes: [],
  edges: [],
  pageInfo: Object.freeze({
    startCursor: null,
    endCursor: null,
    hasPreviousPage: false,
    hasNextPage: false,
  }),
  totalCount: 0,
});

export { Connection, IConnectionType, IEdgeType, PageInfo, First, Last, Before, After, IPagination };
