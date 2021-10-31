/**
 * There is a bug where, when loaded using ES Modules,
 *  decorated classes that reference each-other in a circular way
 *  will cause the program to crash because TypeScript emits a reference to the other class
 *  in its decorator metadata.
 *
 *  Unfortunately decorator metadata is required by @nest/graphql so we cannot disable it.
 *
 *  This wrapper prevents TypeScript from emitting the metadata.
 */
export type NoEmitDecoratorMetadata<T> = T;
