# Dollar bills

`one.svg` and `five.svg` are original vector illustrations made for AMP of the
fronts of United States one-dollar and five-dollar Federal Reserve Notes.
The portraits of George Washington and Abraham Lincoln, denomination glyphs,
ornament, hatching and simplified seals are drawn with SVG paths and patterns.
No photograph, scan, tracing or raster image was used. Serial numbers and
signature flourishes are invented. These are teaching illustrations, not
facsimiles; engraving details are simplified for small figures.

Both notes use a 1228 × 522 viewBox, matching the 6.14 × 2.61 proportions.
Paper and ink colors are fixed in light and dark themes. Corner numerals use
paths; inscriptions use local Georgia/Times/serif fonts, with no font request.

Run `npx tsx scripts/build-bill-art.ts` from `amp/` after editing either SVG.
It embeds their exact bytes in `../bill-art.ts` as data URLs. `BillFace` draws
them in scenes, including app figures, print and lesson films, without waiting
on the network. `tests/bill-art.test.ts` checks the embedded bytes and renderer.
Highlighting adds an accent outline; the illustration keeps its colors.

A scene element such as
`{"type":"bill","id":"dollar","value":1,"at":[0,0],"width":100}`
places one note. `at` is its lower-left corner in math coordinates (y up);
width is in math units and height follows the note's proportions. Repeat
elements at different positions for a row or overlapping stack. Later elements
cover earlier ones. Film scene actions target the element's id directly.
