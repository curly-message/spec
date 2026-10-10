// Code keeps its contrast inside a placeholder.
//
// A message is drawn over the box a placeholder is shaded with, and the box is
// laid over a code block, on a page and in the playground alike. Every ink of
// the palette has to hold WCAG's 4.5:1 for text there, in both themes. A box
// inside a box adds no shade of its own, so one box is the deepest ground
// there is.
//
// Both are read from the tokens and from the one rule that draws a box inside
// a box. Which part a rule draws in which ink, and what a browser paints, are
// not checked here.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const css = (await readFile(new URL('../style.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');

const declarations = (block) =>
  Object.fromEntries(block.split(';').map((declaration) => declaration.split(/:(.*)/s).map((part) => part.trim())).filter(([property, value]) => property && value));

const light = declarations(css.match(/^:root \{([^}]*)\}/m)[1]);
const dark = { ...light, ...declarations(css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([^}]*)\}/)[1]) };

// The base and every ink but the box's own shade and edge.
const inks = ['--base', ...Object.keys(light).filter((name) => name.startsWith('--ink-') && !name.startsWith('--ink-ph'))];

const rgba = (value) => {
  const hex = value.match(/^#([\da-f]{6})$/i);
  if (hex) return [0, 2, 4].map((at) => parseInt(hex[1].slice(at, at + 2), 16)).concat(1);
  const rgb = value.match(/^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)%\)$/);
  assert.ok(rgb, `${value} is not written as #rrggbb or rgb(r g b / a%)`);
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Number(rgb[4]) / 100];
};
const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
// A browser rounds a translucent blend and may land a level beyond it
// (Chromium draws 7% ink over the light code block at 218 where the exact
// blend is 219.02), so an ink has to hold a level either side of the exact
// value, rounded outward.
const drawn = (rgb) => [rgb.map((channel) => Math.floor(channel) - 1), rgb.map((channel) => Math.ceil(channel) + 1)];
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((channel) => channel / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

for (const [theme, palette] of [['light', light], ['dark', dark]]) {
  test(`every ink holds 4.5:1 in a placeholder, ${theme}`, () => {
    const box = over(rgba(palette['--ink-ph']), rgba(palette['--surface']));
    for (const name of inks) {
      const ratio = Math.min(...drawn(box).map((ground) => contrast(over(rgba(palette[name]), ground), ground)));
      assert.ok(ratio >= 4.5, `${name} ${palette[name]} in a placeholder: ${ratio.toFixed(2)}:1`);
    }
  });
}

test('a placeholder inside a placeholder paints no background', () => {
  const nested = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => selector.split(',').some((one) => one.replace(/\s+/g, ' ').trim() === '.ink-ph .ink-ph'))
    .flatMap(([, , block]) => Object.entries(declarations(block)).filter(([property]) => ['background', 'background-color', 'background-image'].includes(property)));
  assert.ok(nested.length, 'no rule sets the background of a placeholder inside a placeholder');
  for (const [property, value] of nested) assert.match(value, /^(none|transparent)$/, `${property}: ${value}`);
});
