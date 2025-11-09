export const composeWithCxt =
  (cxt) =>
  (...fns) =>
  (...args) => {
    return fns.reduceRight((res, fn, idx) => {
      return idx === fns.length - 1 ? fn(cxt)(...args) : fn(cxt)(res);
    }, args);
  };
