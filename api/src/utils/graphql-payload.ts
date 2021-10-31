import type { Type as Type2 } from '@nestjs/common';
import { Field, ObjectType, registerEnumType } from '../esm-compat/nest-graphql-esm';

interface IPayloadError<ErrorCodes> {
  message: string;
  code: ErrorCodes;
}

interface IPayloadType<Node, ErrorCodes> {
  node: Node | null;
  error: IPayloadError<ErrorCodes> | null;

  withNode(node: Node): this;
  withError(code: ErrorCodes, message: string): this;
}

interface Type<T = any> extends Function {
  new (...args: any[]): T;

  T: T;
}

function SuccessOnlyPayload<Node>(name: string, NodeType: Type2<Node>): Type<IPayloadType<Node, never>> {
  @ObjectType(`${name}Payload`)
  class PayloadType implements IPayloadType<Node, never> {
    @Field(() => NodeType, { nullable: true })
    node: Node | null;

    error: null;

    withNode(node: Node): this {
      this.node = node;

      return this;
    }

    withError(): this {
      throw new Error('Cannot call withError on payload type that accept no error code');
    }
  }

  // @ts-expect-error
  return PayloadType as Type<IPayloadType<Node, never>>;
}

function Payload<Node, ErrorCodes extends string, TEnumValue extends string>(
  name: string,
  NodeType: Type2<Node>,
  ErrorCodesEnum: { [key in ErrorCodes]: TEnumValue },
): Type<IPayloadType<Node, ErrorCodes>> {

  const isEmptyEnum = Object.keys(ErrorCodesEnum).length === 0;
  if (isEmptyEnum) {
    return SuccessOnlyPayload(name, NodeType);
  }

  registerEnumType(ErrorCodesEnum, { name: `${name}ErrorCodes` });

  @ObjectType(`${name}Error`)
  class PayloadErrorType implements IPayloadError<ErrorCodes> {
    constructor(code: ErrorCodes, message: string) {
      this.code = code;
      this.message = message;
    }

    @Field(() => ErrorCodesEnum)
    code: ErrorCodes;

    @Field(() => String)
    message: string;
  }

  @ObjectType(`${name}Payload`)
  class PayloadType implements IPayloadType<Node, ErrorCodes> {
    @Field(() => NodeType, { nullable: true })
    node: Node | null;

    @Field(() => PayloadErrorType, { nullable: true })
    error: PayloadErrorType | null;

    withNode(node: Node): this {
      this.node = node;
      this.error = null;

      return this;
    }

    withError(code: ErrorCodes, message: string): this {
      this.node = null;
      this.error = new PayloadErrorType(code, message);

      return this;
    }
  }

  return PayloadType as Type<IPayloadType<Node, ErrorCodes>>;
}

export { Payload, IPayloadType, IPayloadError };
