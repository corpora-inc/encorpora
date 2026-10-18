import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

let embedded: string | undefined;

/** Node-only print assets: no stylesheet or font request is needed by the HTML. */
export function printMathCss(): string {
  if (embedded !== undefined) return embedded;
  const require = createRequire(import.meta.url);
  const cssPath = require.resolve("katex/dist/katex.min.css");
  const directory = dirname(cssPath);
  embedded = readFileSync(cssPath, "utf8").replace(
    /src:[^;}]+/g,
    (declaration) => {
      const font = /url\((fonts\/[^)]+\.woff2)\)/.exec(declaration)?.[1];
      if (!font) throw new Error("Expected an installed KaTeX WOFF2 font");
      // Escape every byte: valid binary data URLs without accidental source words.
      const data = [...readFileSync(join(directory, font))]
        .map((byte) => `%${byte.toString(16).padStart(2, "0")}`)
        .join("");
      return `src:url("data:font/woff2,${data}") format("woff2")`;
    },
  );
  if (/url\((?!"data:)/.test(embedded))
    throw new Error("Unembedded print asset");
  return embedded;
}
