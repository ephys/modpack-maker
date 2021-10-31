import type { FindByCursorResult } from '@ephys/sequelize-cursor-pagination';
import type { Type } from '@nestjs/common';
import { Model } from 'sequelize-typescript';
import { MaybePromise } from '../../../common/typing-utils';
import { Field, ObjectType, Int, ArgsType } from '../esm-compat/nest-graphql-esm';
import { clamp, lastItem } from './generic-utils';

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

type ICursorPagination = {
  first?: number | null,
  last?: number | null,
  before?: string | null,
  after?: string | null,
};

export type INormalizedCursorPagination = {
  first: number | null,
  last: number | null,
  before: object | null,
  after: object | null,
};

export function isCursorPagination(arg: any): arg is ICursorPagination {
  return 'first' in arg || 'last' in arg || 'before' in arg || 'after' in arg;
}

export function normalizePagination(pagination: ICursorPagination, maxReturnCount: number): INormalizedCursorPagination;
export function normalizePagination(pagination: IOffsetPagination, maxReturnCount: number): INormalizedOffsetPagination;
export function normalizePagination(
  pagination: ICursorPagination | IOffsetPagination,
  maxReturnCount: number,
): INormalizedCursorPagination | INormalizedOffsetPagination {
  if (isCursorPagination(pagination)) {
    const first = pagination.first ?? (pagination.last == null ? maxReturnCount : null);

    return {
      before: pagination.before ? defaultDecodeCursor(pagination.before) : null,
      after: pagination.after ? defaultDecodeCursor(pagination.after) : null,
      last: pagination.last ? clamp(1, pagination.last, maxReturnCount) : null,
      first: first ? clamp(1, first, maxReturnCount) : null,
    };
  }

  // offset pagination
  return {
    limit: pagination.limit ?? maxReturnCount,
    offset: pagination.offset ?? 0,
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
    @Field(() => [EdgeType])
    edges: EdgeType[];

    @Field(() => [classRef])
    nodes: T[];

    @Field(() => Int)
    totalCount: number;

    @Field()
    pageInfo: PageInfo;
  }

  return PaginatedType as Type<IConnectionType<T>>;
}

@ArgsType()
class CursorPaginationArgs implements ICursorPagination {
  @Field(() => Int, { nullable: true })
  first: number | null;

  @Field(() => Int, { nullable: true })
  last: number | null;

  @Field(() => String, { nullable: true })
  after: string | null;

  @Field(() => String, { nullable: true })
  before: string | null;

  isEmpty() {
    return this.first == null && this.last == null && this.after == null && this.before == null;
  }
}

type INormalizedOffsetPagination = {
  limit: number,
  offset: number,
};

type IOffsetPagination = {
  limit: number | null,
  offset: number | null,
};

@ArgsType()
class OffsetPaginationArgs implements IOffsetPagination {
  @Field(() => Int, { nullable: true })
  limit: number | null;

  @Field(() => Int, { nullable: true })
  offset: number | null;

  isEmpty() {
    return this.limit == null && this.offset == null;
  }
}

type TOpts<T> = {
  totalCount?(): MaybePromise<number>,
  getCursor?(node: T, result: FindByCursorResult<T>): string,
};

function defaultGetCursor<T>(node: T, result: FindByCursorResult<T>): string {
  const out = Object.create(null);

  for (const key of result.cursorKeys) {
    let value = node instanceof Model ? node.get(key) : node[key];

    if (value === undefined) {
      throw new Error(`node is missing cursor key ${key}`);
    }

    if (value instanceof Date) {
      value = value.toISOString();
    }

    out[key] = value;
  }

  return Buffer.from(JSON.stringify(out)).toString('base64');
}

export function defaultDecodeCursor(cursor: string | null): object | null {
  if (cursor == null) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  } catch (e) {
    return null;
  }
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

export {
  Connection,
  IConnectionType,
  IEdgeType,
  PageInfo,
  ICursorPagination,
  CursorPaginationArgs,
  IOffsetPagination,
  OffsetPaginationArgs,
};
