export const compose =
  (...fns) =>
  (...args) => {
    return fns.reduceRight((res, fn, idx) => {
      return idx === fns.length - 1 ? fn(...args) : fn(res);
    }, args);
  };

export const composeWithCxt =
  (cxt) =>
  (...fns) =>
  (...args) => {
    return fns.reduceRight((res, fn, idx) => {
      return idx === fns.length - 1 ? fn(cxt)(...args) : fn(cxt)(res);
    }, args);
  };

export const pipe =
  (...fns) =>
  (...args) => {
    return fns.reduce((res, fn, idx) => {
      return idx === 0 ? fn(...args) : fn(res);
    }, args);
  };

export const pipeWithCxt =
  (cxt) =>
  (...fns) =>
  (...args) => {
    return fns.reduce((res, fn, idx) => {
      return idx === 0 ? fn(cxt)(...args) : fn(cxt)(res);
    }, args);
  };

export const head = (a) => a?.[0];

export const last = (a) => a?.[a.length - 1];

export const map = (fn) => (a) => a?.map(fn);

export const filter = (fn) => (a) => a?.filter(fn);

export const filterTruthy = (a) => a?.filter(Boolean);

export const isString = (s) => typeof s === "string";
export const isNumber = (n) => typeof n === "number";
export const isBool = (b) => typeof b === "boolean";
export const isFunction = (f) => typeof f === "function";
export const isNull = (n) => n === null;
export const isUndefined = (u) => u === undefined;
export const isArray = (a) => Array.isArray(a);
export const isNullOrUnd = (v) => isNull(v) || isUndefined(v);

export const toArray = (collection) => {
  if (collection?.values) return [...collection.values()];
  if (collection?.[Symbol.iterator]) return [...collection];
  if (isNumber(collection)) return [collection];
  if (isBool(collection)) return [collection];
  if (!collection) return [];
  return Object.values(collection);
};

export const trace = (label) => (x) => {
  console.log(label, x);
  return x;
};

export const traceWithCxt = (label) => (cxt) => (x) => {
  console.log(label, cxt, x);
  return x;
};
