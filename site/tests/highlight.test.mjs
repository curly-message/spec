// Colouring a message deeper than a call can recurse.
//
// The parser describes a message however deep it nests, and the colouring
// has to keep up: the pieces it answers with are read again by the markup
// writer and by the playground, each of which recurses once per box. So the
// pieces must spell the message back at any depth and nest a bounded number
// of boxes deep.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cst } from '@curly-message/parser';
import { highlight } from '../highlight.js';

const nested = (depth) => `${'{{a; x:'.repeat(depth)}deep${'}}'.repeat(depth)}`;

// What the pieces spell, and how many boxes deep they go, read on a stack of
// its own so the reading holds however deep they nest.
const read = (pieces) => {
  let text = '';
  let deepest = 0;
  const stack = [{ list: pieces, at: 0, depth: 0 }];
  while (stack.length) {
    const top = stack[stack.length - 1];
    if (top.at === top.list.length) {
      stack.pop();
      continue;
    }
    const piece = top.list[top.at++];
    if (piece.nodes) {
      assert.equal(piece.cls, 'ink-ph');
      deepest = Math.max(deepest, top.depth + 1);
      stack.push({ list: piece.nodes, at: 0, depth: top.depth + 1 });
    } else text += piece.text;
  }
  return { text, deepest };
};

test('colours a message nested deeper than a call can recurse', () => {
  const message = nested(100000);

  assert.deepEqual(read(highlight(message, 'curly', cst)), { text: message, deepest: 8 });
});

test('boxes a placeholder in its own box down to the depth every implementation resolves', () => {
  for (const depth of [1, 2, 8, 9]) {
    const message = nested(depth);
    assert.deepEqual(read(highlight(message, 'curly', cst)), { text: message, deepest: Math.min(depth, 8) });
  }
});

test('draws a placeholder below that depth in the box of the one holding it', () => {
  let box = highlight(nested(9), 'curly', cst)[0];
  for (let level = 1; level < 8; level += 1) box = box.nodes.find((piece) => piece.nodes);
  const level = [
    ['ink-brace', '{{'],
    ['ink-key', 'a'],
    ['ink-brace', ';'],
    ['ink-text', ' '],
    ['ink-option-key', 'x'],
    ['ink-brace', ':'],
  ];

  assert.deepEqual(
    box.nodes.map(({ cls, text }) => [cls, text]),
    [...level, ...level, ['ink-option-value', 'deep'], ['ink-brace', '}}'], ['ink-brace', '}}']],
  );
});
