# Lingo Hero — vendored fonts

Offline-first: these fonts ship with the pack so there are no remote font
requests at runtime (the old Google Fonts `@import` in `styles.css` was
removed).

## Files

| File              | Family          | Weight | Role                                  |
| ----------------- | --------------- | ------ | ------------------------------------- |
| `lato-400.woff2`  | `Lingo Sans`    | 400    | Body / labels                         |
| `lato-700.woff2`  | `Lingo Sans`    | 700    | Emphasis                              |
| `lato-900.woff2`  | `Lingo Sans`    | 900    | Heavy UI text; also aliased to canvas |
| `lato-heavy.woff2`| `Lingo Display` | 800    | Big display headlines + scores        |

`lato-900.woff2` is also bound to `@font-face { font-family: "Russo One" }`
because `src/Renderer.ts` hard-codes `'Russo One'` for canvas glyph rendering.
Keeping that family name satisfied means the canvas text renders with a
vendored font and no network. Do not rename it without coordinating with the
Renderer owner.

## Source + license

Font: **Lato** by Łukasz Dziedzic, licensed under the SIL Open Font License
1.1 (see `Lato-LICENSE.txt`). Vendored from the system `fonts-lato` package and
subset to Latin + Latin Extended-A + common punctuation/symbols with
`pyftsubset --flavor=woff2` to keep each file ~80 KB. Non-Latin scripts (CJK,
Arabic, Hebrew, etc.) fall back to the platform system font, which is correct
since Lato does not cover them.
