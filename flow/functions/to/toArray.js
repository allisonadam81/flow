export const toArray = (collection) => {
  if (collection?.values) return [...collection.values()];
  if (collection?.[Symbol.iterator]) return [...collection];
  if (!collection) return [];
  if (collection?.constructor === Object) return Object.values(collection);
  return [collection];
};
