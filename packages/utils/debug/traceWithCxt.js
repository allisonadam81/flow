export const traceWithCxt = (label) => (cxt) => (x) => {
  console.log(label, cxt, x);
  return x;
};
