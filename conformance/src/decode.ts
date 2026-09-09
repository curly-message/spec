const TAG = '$curly';

type Tag = { [TAG]: unknown; count?: unknown };

/**
 * A value whose serialization visits at least `count` nodes. Serialization
 * follows a shared reference again every time it meets one, so each level of
 * `[below, below]` spends one node on itself and twice what `below` spends,
 * and the tree doubles its visits per level without ever holding a cycle.
 */
export const nodes = (count: number) => {
  let tree: unknown[] = [];

  for (let visits = 1; visits < count; visits = visits * 2 + 1) tree = [tree, tree];

  return tree;
};

const unserializable = () => {
  const value: Record<string, unknown> = {};

  value.self = value;

  return value;
};

const isTag = (value: object): value is Tag => Object.hasOwn(value, TAG);

const tagged = (tag: Tag) => {
  switch (tag[TAG]) {
    case 'undefined':
      return undefined;
    case 'unserializable':
      return unserializable();
    case 'nodes':
      if (typeof tag.count !== 'number') throw new Error('A nodes tag needs a numeric count.');

      return nodes(tag.count);
    default:
      throw new Error(`Unknown tag ${JSON.stringify(tag[TAG])}.`);
  }
};

/** The host value a fixture's JSON stands for: tagged objects replaced, everything else as JSON describes it. */
export const decode = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(decode);

  if (value === null || typeof value !== 'object') return value;

  if (isTag(value)) return tagged(value);

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, decode(entry)]));
};
