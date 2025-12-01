export const identity = <T>(v: T): T => v;
export const invoke = <T>(fn: (() => T) | null): T | false =>
  typeof fn === 'function' && fn();

export const isFunction = <T>(fn: T) => typeof fn === 'function';

export const toArray = (collection: any): any[] => {
  if (collection?.values) return [...collection.values()];
  if (collection?.[Symbol.iterator]) return [...collection];
  if (!collection) return [];
  if (collection?.constructor === Object) return Object.values(collection);
  return [collection];
};
export const isError = <T>(e: T) => e instanceof Error;
export const isNullOrUnd = <T>(v: T) => v === null || v === undefined;
export const isPromise = <T>(v: T) => v instanceof Promise;

export const map = (fn) => (a) => a?.map(fn);

export const tryCatchFinally = (t, c = identity, f) => {
  try {
    return t();
  } catch (e) {
    return c(e);
  } finally {
    if (typeof f === 'function') f();
  }
};
