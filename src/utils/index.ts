export const identity = <T>(v: T): T => v;
export const invoke = <T>(fn: (() => T) | null): T | false =>
  typeof fn === 'function' && fn();

export const isFunction = <T>(fn: T) => typeof fn === 'function';
export const tail = (arr: any[]) => arr?.[arr.length - 1];
export const head = (arr: any[]) => arr?.[0];

export const toEntries = (collection) => {
  if (collection === null) return [];
  if (collection === undefined) return [];
  if (collection.constructor === Object) return Object.entries(collection);
  if (collection.entries && typeof collection.entries === 'function')
    return [...collection.entries()];
  return [[0, collection]];
};

export const fromEntries = (entries, src) => {
  if (src === null) return src;
  if (src === undefined) return src;
  if (Array.isArray(src)) {
    return entries.map(([_, v]) => v);
  }
  if (src instanceof Map) {
    return new Map(entries);
  }
  if (src instanceof Set) {
    return new Set(entries.map(([_, v]) => v));
  }
  if (src.constructor === Object) {
    return Object.fromEntries(entries);
  }
  if (entries.length === 0) return undefined;
  return entries[0][1];
};

export const toValues = (collection: any): any[] => {
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
