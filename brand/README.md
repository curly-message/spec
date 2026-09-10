# Brand

The visual identity of the Curly Message Format.

| File | What it is |
| --- | --- |
| [`curly-icon.svg`](./curly-icon.svg) | The icon: a brace and a C. `viewBox="0 0 1024 1024"` |
| [`curly-wordmark.svg`](./curly-wordmark.svg) | The wordmark: the icon, the letters `URLY` and the line `Message format`. `viewBox="0 0 1007 408"` |
| [`curly-wordmark-no-tagline.svg`](./curly-wordmark-no-tagline.svg) | The wordmark without that line, in its own tight box. `viewBox="0 0 1007 297"` |

Every file is one `<path>` on a transparent background with no `fill`, no
`width` and no `height`, so it renders black by default, takes any `fill` for a
light-on-dark variant, and scales to whatever box it is given.

## How the three files relate

The wordmark is built from the icon, not drawn beside it:

- the `{C` at its head **is** `curly-icon.svg`'s path, uniformly scaled so the
  icon's height becomes the cap height (256 units) and translated into place;
- the fork of the `Y` is the same path again, rotated a quarter turn
  counter-clockwise so the arm ends point up and the brace's cusp points down,
  and scaled to 175.5 units wide. Its silhouette is still the icon's: the two
  arms are thickened along their inner edges - from 84.10 to 122.70 icon units,
  before the rotation - until the prongs measure the mark's single stroke,
  40.7 units, rather than the thinner arms the smaller scale would otherwise
  give. Nothing moves outward except each prong tip's cap, which rounds back by
  about 6 units because a split cap's two radii scale with the arm they close;
- the fork sits above the stem by the icon's own brace-to-C gap, 12.9 units,
  and the stem's top is not flat: it follows the underside of the fork at that
  same constant offset, so the channel between them holds its width from one
  shoulder to the other and 83.2 units of stem are left below the cusp;
- `U`, `R`, `L` and the `Y`'s stem are drawn at one stroke width, 40.7 units,
  which is the thickness of the icon's horizontal arms at the scale the `{C`
  is placed. Every free terminal of `U`, `R`, `L` and the foot of the `Y`'s
  stem is a semicircle of half that width.

So the letters are drawn at one weight and one shape vocabulary; where the icon
appears it keeps the modulation it was drawn with, which is why the fork's
nested V reads lighter than its prongs. The icon survives a redraw of the
letters unchanged. The letters and the fork are made of straight lines and
circular arcs only; the tagline carries the quadratics of its typeface,
converted to outlines.

## Using them

- Give the wordmark clear space of at least half the letter stroke, which is the
  padding already inside the viewBox.
- Below roughly 200 px wide the tagline stops being legible: use
  `curly-wordmark-no-tagline.svg`, which stays readable down to about 64 px.
- Colour by setting `fill` on the `<svg>` or the `<path>`, or with
  `color` and `fill="currentColor"` if you add that attribute yourself.

## Provenance

The tagline is set in Wix Madefor Display 600, converted to outlines. The face
is published under the SIL Open Font License 1.1; artwork made with a font is
not itself a font, so the outlines carry no licence obligation, but the
attribution is recorded here because the wordmark cannot be re-set without it.
