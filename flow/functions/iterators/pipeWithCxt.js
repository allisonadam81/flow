export const pipeWithCxt =
  (cxt) =>
  (...fns) =>
  (...args) => {
    return fns.reduce((res, fn, idx) => {
      return idx === 0 ? fn(cxt)(...args) : fn(cxt)(res);
    }, args);
  };
