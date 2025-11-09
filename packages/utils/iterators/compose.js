export const compose =
  (...fns) =>
  (...args) => {
    return fns.reduceRight((res, fn, idx) => {
      return idx === fns.length - 1 ? fn(...args) : fn(res);
    }, args);
  };
