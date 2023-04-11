/**
 * Creates an object that throws when used. Can be used as the default value of something that should be provided.
 *
 * @returns {Function}
 */
export function createTrappedCallable<T>(providerName?: string): T {

  function triggerTrap(): never {
    if (providerName) {
      throw new Error(`This object should not be used. Make sure provider ${providerName} is available in react tree`);
    }

    throw new Error('This object should not be used. It is possible you received this object instead of another because it has not been initialized');
  }

  return new Proxy(triggerTrap, {
    getPrototypeOf: triggerTrap,
    setPrototypeOf: triggerTrap,
    isExtensible: triggerTrap,
    preventExtensions: triggerTrap,
    getOwnPropertyDescriptor: triggerTrap,
    defineProperty: triggerTrap,
    has: triggerTrap,
    get: triggerTrap,
    set: triggerTrap,
    deleteProperty: triggerTrap,
    ownKeys: triggerTrap,
    apply: triggerTrap,
    construct: triggerTrap,
  }) as unknown as T;
}
