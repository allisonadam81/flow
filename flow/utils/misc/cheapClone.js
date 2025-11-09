export const cheapClone = (v) =>
  v === undefined ? v : JSON.parse(JSON.stringify(v));
