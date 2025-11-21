export const identity = (v) => v;
export const invoke = (fn) => typeof fn === 'function' && fn();

export const isFunction = (fn) => typeof fn === 'function';

export const toArray = (collection) => {
  if (collection?.values) return [...collection.values()];
  if (collection?.[Symbol.iterator]) return [...collection];
  if (!collection) return [];
  if (collection?.constructor === Object) return Object.values(collection);
  return [collection];
};
export const isError = (e) => e instanceof Error;
export const isNullOrUnd = (v) => v === null || v === undefined;
export const isPromise = (v) => v instanceof Promise;

export const isBadValue = (v) => {
  return [() => isError(v), () => isNullOrUnd(v), () => Number.isNaN(v)].some(
    (fn) => fn()
  );
};
