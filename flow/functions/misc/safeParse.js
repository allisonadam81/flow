export const safeParse = (s) => {
  try {
    return JSON.parse(s);
  } catch (e) {
    return s;
  }
};
