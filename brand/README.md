# Brand

The visual identity of the Curly Message Format.

![The wordmark on a dark ground, the brace in the theme colour](./usage.png)

| File | What it is |
| --- | --- |
| [`curly-icon.svg`](./curly-icon.svg) | The icon: a brace and a C. `viewBox="0 0 1024 1024"` |
| [`curly-wordmark.svg`](./curly-wordmark.svg) | The wordmark: the icon, the letters `URLY` and the line `MESSAGE FORMAT`. `viewBox="0 0 999 406"` |
| [`curly-wordmark-no-tagline.svg`](./curly-wordmark-no-tagline.svg) | The wordmark without that line, in its own tight box. `viewBox="0 0 999 297"` |
| [`usage.png`](./usage.png) | The plate above: the wordmark in colour on the dark ground, 2800×1160. A picture of the marks, not an asset to place. |

Each of the three SVGs is one `<path>` on a transparent background with no
`fill`, no `width` and no `height`, so it renders black by default, takes any
`fill` for a light-on-dark variant, and scales to whatever box it is given.

## How the three marks relate

The wordmark is built from the icon, not drawn beside it. The `{C` at its head
**is** `curly-icon.svg`'s path, uniformly scaled so the icon's height becomes
the cap height (256 units) and translated into place. Everything after it is
drawn to four numbers the icon supplies:

| | Units | Where it comes from |
| --- | --- | --- |
| Stroke | 40.70 | the thickness of the icon's horizontal arms at the scale the `{C` is placed |
| Letter width | 174.93 | the icon's `C` is 172.39 wide; the letters take the widest of the traced boxes, the `R`'s |
| Corner radius | 64.98 outer, 24.28 inner | the largest of the icon's own outer curves, 44.63 on the centre line |
| Gap | 20.60 | the same at every joint: icon to `U`, `U` to `R`, `R` to `L` |

So `U`, `R`, `L` and `Y` are one width and one weight, every corner in all four
turns on one radius, and the three gaps are one gap. Free terminals are
semicircles of half the stroke, 20.35, which is how the icon's arms end too.
Where a stroke runs into the side of another — the `R`'s leg under its bar, the
`Y`'s stem under its fork — the junction is rounded by 15.69.

Two shapes carry their own decisions:

- the `R` has a connected top: the stem runs the whole cap height and the bowl
  springs off it and closes back onto it, so the letter has no free bar
  terminal. Its bar sits 133.76 below the cap line and the leg leaves that bar
  53.95 right of the stem, at 38.3° from vertical;
- the `Y` is a `U` fork on a stem, not a rotated brace. The fork is the letter
  width, its bar sits 128.55 below the cap line, and the stem rises 25.50 into
  that bar so the two read as one letter. The fork overlaps the `L`'s foot by
  37.27 — the mark's one kern, which is why `L` and `Y` have no gap between
  them.

The tagline is the one part of the wordmark that is not drawn from the icon's
numbers. It is set in capitals at 52.0 with 0.22 em of letter spacing, its cap
line 72 below the letters' baseline, and its ink centre on the wordmark's ink
centre rather than on the viewBox — the `{` at the head and the `Y` at the tail
weigh differently, so centring on the box would read as off-centre.

The icon survives a redraw of the letters unchanged: where it appears it keeps
the modulation it was drawn with, which is why its brace reads lighter than the
letters beside it. The letters are made of straight lines and circular arcs
only; the tagline carries the quadratics of its typeface, converted to
outlines.

## Using them

- Give the wordmark clear space of at least half the letter stroke, which is the
  padding already inside the viewBox.
- Below roughly 280 px wide the tagline stops being legible: use
  `curly-wordmark-no-tagline.svg`, which stays readable down to about 64 px.
- Colour by setting `fill` on the `<svg>` or the `<path>`, or with
  `color` and `fill="currentColor"` if you add that attribute yourself.

## Colour

The plate at the top is variant A of the dark treatment: the brace in the
theme colour, the `C` and the letters in the base, the tagline dimmed. The
three neutrals are settled:

| | | Contrast on the ground |
| --- | --- | --- |
| Ground | `#14161A` | |
| Base | `#F5F5F3` | 16.6:1 |
| Dimmed | `#8A8F98` | 5.6:1 |

The theme colour is not. The `#F2A61A` in the plate is a placeholder picked
for this one file, 8.8:1 on the ground; mint `#2DD4BF` at 9.7:1, vermilion
`#FF6B4A` at 6.4:1 and periwinkle `#818CF8` at 6.1:1 were the other
candidates, all of them past AA here. Nothing in the SVGs depends on the
choice — they carry no `fill` at all.

Two colours need two elements. Each SVG is a single `<path>` filled nonzero,
so `fill` cannot colour the brace apart from the rest; split the path's
subpaths into separate `<path>` elements first, keeping their order. In
`curly-wordmark.svg` the first subpath is the brace, the second the `C`, the
next eleven the letters, and the remaining twenty-seven the tagline.

## Licence

The marks are **not** covered by the repository's MIT licence. The name *Curly
Message Format*, the three SVGs and the plate are © 2026
G.A.W.Group, s.r.o., all rights reserved, under the terms in
[`LICENSE`](./LICENSE) beside this file.

The short of it: you may say your software implements the format, and you may
use these files unchanged to refer to it — scaled to any size, in any single
colour. You may not redraw them, fold them into a mark of your own, or use
them in a way that reads as official or endorsed. The format is open; its
marks are how people tell it apart from everything else.

## Provenance

The marks were traced from three generated bitmaps — the icon on a light
rounded tile, and two wordmark variants differing only in the `Y`. They are not
kept here. Nothing in these files still matches them: the letters were redrawn
afterwards to the icon's own numbers and the tagline was re-set in capitals, so
the bitmaps are the origin of the mark rather than a target it answers to.

The tagline is set in Outfit 600, converted to outlines. The face is published
under the SIL Open Font License 1.1; artwork made with a font is not itself a
font, so the outlines carry no licence obligation, but the attribution is
recorded here because the wordmark cannot be re-set without it.
