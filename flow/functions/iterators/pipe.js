export const pipe =
  (...fns) =>
  (...args) => {
    return fns.reduce((res, fn, idx) => {
      return idx === 0 ? fn(...args) : fn(res);
    }, args);
  };
