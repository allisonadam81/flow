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

export const trace = (label) => (x) => {
  console.log(label, x);
  return x;
};

export const traceWithCxt = (label) => (cxt) => (x) => {
  console.log(label, cxt, x);
  return x;
};
