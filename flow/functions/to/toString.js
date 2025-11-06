export const toString = (v) => {
  if (v.toString) return v.toString();
  return `${v}`;
};
