import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

/** Workbook type, embedded so every renderer (a laptop, CI, the server's
 * Chromium) prints the same letters with no font request:
 * - IBM Plex Sans for reading: 1, l and I differ, and 0 is a plain oval, as
 *   in children's textbooks.
 * - Andika for kindergarten to grade 2: the single-storey a and g that
 *   children learn to write.
 * - Fraunces for headings, soft for young learners and plain for older ones.
 * All three are SIL Open Font License 1.1. Latin subsets only; anything else
 * falls back to the system sans. */
const faces = {
  reading: [
    {
      family: "WB Reading",
      weight: "100 700",
      file: "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2",
    },
    {
      family: "WB Reading",
      weight: "100 700",
      style: "italic",
      file: "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-italic.woff2",
    },
  ],
  early: [
    {
      family: "WB Early",
      weight: "400",
      file: "@fontsource/andika/files/andika-latin-400-normal.woff2",
    },
    {
      family: "WB Early",
      weight: "700",
      file: "@fontsource/andika/files/andika-latin-700-normal.woff2",
    },
  ],
  display: [
    {
      family: "WB Display",
      weight: "100 900",
      file: "@fontsource-variable/fraunces/files/fraunces-latin-soft-normal.woff2",
    },
  ],
} as const;

const cache = new Map<string, string>();
/** @font-face rules for the workbook. `early` adds the young learners' face. */
export function workbookFontCss(early: boolean): string {
  const key = early ? "early" : "standard";
  const hit = cache.get(key);
  if (hit) return hit;
  const require = createRequire(import.meta.url);
  const list = [
    ...faces.reading,
    ...faces.display,
    ...(early ? faces.early : []),
  ];
  const css = list
    .map((face) => {
      const data = readFileSync(require.resolve(face.file)).toString("base64");
      const style = "style" in face ? face.style : "normal";
      return `@font-face{font-family:"${face.family}";font-style:${style};font-weight:${face.weight};font-display:block;src:url(data:font/woff2;base64,${data}) format("woff2")}`;
    })
    .join("");
  cache.set(key, css);
  return css;
}
