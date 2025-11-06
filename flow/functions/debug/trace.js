export const trace = (label) => (x) => {
  console.log(label, x);
  return x;
};
