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

export const trace = (label) => (x) => {
  console.log(label, x);
  return x;
};

export const traceWithCxt = (label) => (cxt) => (x) => {
  console.log(label, cxt, x);
  return x;
};
