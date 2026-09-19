import type { Adapter, ExpectedNode, Failure, Node, NodeType, Outcome, SpanUnit, TreeCase } from './types';

/** The units CST.md section 4 lets an implementation count its spans in. */
export const UNITS: readonly SpanUnit[] = ['utf-8', 'utf-16', 'code-point'];

const TYPES: readonly NodeType[] = ['message', 'placeholder', 'open', 'close', 'separator', 'space', 'key', 'modifier', 'option-key', 'option-value', 'text', 'escape'];

// The kinds that carry a name, and the one that carries `cancels` (CST.md
// section 8). A kind that must carry a field and does not has answered less
// than the document requires; a field a kind does not take is not policed,
// because that table describes the interchange encoding and an adapter hands
// back a host value.
export const NAMED: readonly NodeType[] = ['key', 'modifier', 'option-key', 'option-value'];

const failure = (reason: string, expected: unknown, actual: unknown): Failure => ({ ok: false, reason, expected, actual });

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';

const encoder = new TextEncoder();

const width = (character: string, unit: SpanUnit) => unit === 'code-point' ? 1 : unit === 'utf-16' ? character.length : encoder.encode(character).length;

/**
 * Where each boundary of the message falls, as an offset into the host's own
 * string, indexed by the unit the adapter declared. A boundary inside a code
 * point has no offset: a character wider than one unit contributes one entry
 * for its start and nothing for the positions within it, which is what CST.md
 * section 4 forbids a span from landing on.
 */
export const boundaries = (message: string, unit: SpanUnit) => {
  const offsets: (number | undefined)[] = [];
  let at = 0;

  for (const character of message) {
    offsets.push(at);

    for (let within = 1; within < width(character, unit); within += 1) offsets.push(undefined);

    at += character.length;
  }

  offsets.push(at);

  return offsets;
};

// A tree describes the message, so what it can hold follows from the message's
// length: the densest construction, a run of empty segments, contributes two
// nodes per character. A structure that holds itself would be walked forever,
// so the walk is bounded by more than any tree of the message can hold, and a
// cyclic answer fails the case instead of hanging the run.
const budget = (units: number) => units * 4 + 64;

type Walked = { node: Node; text: string; depth: number };

// Every node of the tree, in document order, each with the text its span
// covers — or the first thing wrong with one of them, in the order CST.md
// states them: the kinds of section 6, the spans of section 4.
const walk = (root: unknown, message: string, offsets: (number | undefined)[]): Walked[] | Failure => {
  const units = offsets.length - 1;
  const walked: Walked[] = [];
  const visit = (value: unknown, depth: number, within: Node | undefined): Failure | undefined => {
    if (walked.length > budget(units)) return failure('The tree holds more nodes than the message can spell.', `at most ${budget(units)} nodes`, 'more');

    if (!isObject(value)) return failure('The tree holds something that is not a node.', 'a node', value);

    const node = value as unknown as Node;

    if (!TYPES.includes(node.type)) return failure('The tree holds a node of no kind this document names.', TYPES.join(', '), node.type);

    if (!Number.isInteger(node.start) || !Number.isInteger(node.end)) return failure(`The span of the ${node.type} node is not a pair of offsets.`, 'two integers', [node.start, node.end]);

    if (node.end < node.start) return failure(`The ${node.type} node ends before it starts.`, 'end at or after start', [node.start, node.end]);

    if (node.start < 0 || node.end > units) return failure(`The ${node.type} node lies outside the message.`, `within [0,${units})`, [node.start, node.end]);

    if (within && (node.start < within.start || node.end > within.end)) return failure(`The ${node.type} node lies outside the ${within.type} node that holds it.`, [within.start, within.end], [node.start, node.end]);

    const from = offsets[node.start];
    const to = offsets[node.end];

    if (from === undefined || to === undefined) return failure(`The span of the ${node.type} node falls inside a code point.`, 'a boundary between code points', [node.start, node.end]);

    if (NAMED.includes(node.type) && typeof node.name !== 'string') return failure(`The ${node.type} node carries no name.`, 'the span unescaped', node.name);

    if (node.type === 'escape' && typeof node.cancels !== 'boolean') return failure('The escape node does not say which reading it takes.', 'true or false', node.cancels);

    walked.push({ node, text: message.slice(from, to), depth });

    if (node.nodes === undefined) return undefined;

    if (!Array.isArray(node.nodes)) return failure(`The children of the ${node.type} node are not a list.`, 'a list of nodes', node.nodes);

    for (const child of node.nodes) {
      const wrong = visit(child, depth + 1, node);

      if (wrong) return wrong;
    }

    return undefined;
  };

  const wrong = visit(root, 0, undefined);

  return wrong ?? walked;
};

// Properties 1, 2 and 3 of CST.md section 5, which are what a consumer walks a
// tree by: the leaves tile the message in order and spell it back.
const tiling = (walked: Walked[], message: string, units: number): Failure | undefined => {
  const leaves = walked.filter(({ node }) => !node.nodes?.length);
  let at = 0;
  let spelled = '';

  for (const { node, text } of leaves) {
    if (node.start !== at) return failure(`The leaves do not tile the message: a ${node.type} node starts where the one before it did not end.`, at, node.start);

    at = node.end;
    spelled += text;
  }

  if (at !== units) return failure('The leaves do not reach the end of the message.', units, at);

  if (spelled !== message) return failure('The leaves do not spell the message back.', message, spelled);

  return undefined;
};

// The tree as the runner reads it, for comparing one parse with another.
const shape = (walked: Walked[]) => walked.map(({ node, text, depth }) => `${depth}:${node.type}:${JSON.stringify(text)}:${JSON.stringify(node.name)}:${JSON.stringify(node.cancels)}`).join('|');

const children = (node: Node) => node.nodes ?? [];

// What a case expects of one node, against what the implementation answered.
const compare = (expected: ExpectedNode[], actual: Node[], texts: Map<Node, string>, where: string): Failure | undefined => {
  if (expected.length !== actual.length) return failure(`The children of ${where} are ${actual.length} nodes rather than ${expected.length}.`, expected.map(({ type }) => type), actual.map((node) => node?.type));

  for (const [index, wanted] of expected.entries()) {
    const node = actual[index];
    const position = `Node ${index + 1} of ${where}`;

    if (node.type !== wanted.type) return failure(`${position} is of another kind.`, wanted.type, node.type);

    const text = texts.get(node);

    if (text !== wanted.text) return failure(`${position} spans other text.`, wanted.text, text);

    if (wanted.name !== undefined && node.name !== wanted.name) return failure(`${position} is unescaped to something else.`, wanted.name, node.name);

    if (wanted.cancels !== undefined && node.cancels !== wanted.cancels) return failure(`${position} takes the other reading of section 7.`, wanted.cancels, node.cancels);

    if (wanted.nodes === undefined) continue;

    const wrong = compare(wanted.nodes, children(node), texts, `the ${node.type} node`);

    if (wrong) return wrong;
  }

  return undefined;
};

// What the adapter answered, checked before it is read: a tree it raised over,
// or one that is not a message node, fails the case rather than ending the run.
const answer = (cst: NonNullable<Adapter['cst']>, message: string): Node | Failure => {
  let tree: unknown;

  try {
    tree = cst.parse(message);
  } catch (error) {
    return failure('The adapter raised rather than answering with a tree.', 'a message node', error instanceof Error ? error.message : String(error));
  }

  if (!isObject(tree) || (tree as Node).type !== 'message') return failure('The adapter answered with no tree.', 'a message node', tree);

  return tree as unknown as Node;
};

/**
 * Runs a tree case. The properties of CST.md section 5 are checked on the tree
 * the implementation answered with, in the unit it declared, before the case's
 * own expectation is compared: a tree whose leaves do not tile the message is
 * wrong about the message whatever the case says of its nodes.
 */
export const executeTree = (adapter: Adapter, c: TreeCase): Outcome => {
  const cst = adapter.cst;

  if (!cst) throw new Error(`The case ${c.id} was planned against an adapter that offers no tree.`);

  const { message } = c;
  const offsets = boundaries(message, cst.unit);
  const units = offsets.length - 1;
  const tree = answer(cst, message);

  if ('ok' in tree) return tree;

  if (tree.start !== 0 || tree.end !== units) return failure('The tree does not span the whole message.', [0, units], [tree.start, tree.end]);

  const walked = walk(tree, message, offsets);

  if ('ok' in walked) return walked;

  const tiled = tiling(walked, message, units);

  if (tiled) return tiled;

  const compared = compare(c.expected, children(tree), new Map(walked.map(({ node, text }) => [node, text])), 'the message');

  if (compared) return compared;

  const again = answer(cst, message);
  const twice = 'ok' in again ? again : walk(again, message, offsets);

  if ('ok' in twice) return twice;

  if (shape(twice) !== shape(walked)) return failure('The tree is not a function of the message alone: two parses of it differ.', shape(walked), shape(twice));

  if (c.resolves === undefined) return { ok: true };

  let resolved: unknown;

  try {
    resolved = adapter.resolve({ message });
  } catch (error) {
    return failure('The adapter raised resolving the message the tree describes.', c.resolves, error instanceof Error ? error.message : String(error));
  }

  const output = isObject(resolved) ? resolved.output : undefined;

  return output === c.resolves
    ? { ok: true }
    : failure('The tree and the resolution do not read the same placeholders.', c.resolves, output);
};
