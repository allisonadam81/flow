export const head = (a) => a?.[0];
export const last = (a) => a?.[a.length - 1];

export const map = (fn) => (a) => a?.map(fn);
export const flatMap = (fn) => (a) => a?.flatMap(fn);
export const filter = (fn) => (a) => a?.filter(fn);
export const filterTruthy = (a) => a?.filter(Boolean);
export const identity = (i) => i;

export const isString = (s) => typeof s === 'string';
export const isNumber = (n) => typeof n === 'number';
export const isBool = (b) => typeof b === 'boolean';
export const isFunction = (f) => typeof f === 'function';
export const isNull = (n) => n === null;
export const isUndefined = (u) => u === undefined;
export const isArray = Array.isArray;
export const isNullOrUnd = (v) => isNull(v) || isUndefined(v);
export const isPromise = (v) => v instanceof Promise;

export const toArray = (collection) => {
  if (collection?.values) return [...collection.values()];
  if (collection?.[Symbol.iterator]) return [...collection];
  if (!collection) return [];
  if (collection?.constructor === Object) return Object.values(collection);
  return [collection];
};

export const defer = (fn, delay = 0, args) => setTimeout(fn, delay, args);
export const sleep = (delay) => new Promise((resolve) => defer(resolve, delay));
