/** Bundles the API and its workbook and demo workers as production runs them. Guessing
 * chances are computed here, once per image, so no pod pays for them while a
 * learner waits. Both come from the same source, so they cannot disagree. */
import { build } from "esbuild";
import { guessChanceTable } from "../src/math/guess-chance";

const started = performance.now();
const table = guessChanceTable();
await build({
  entryPoints: [
    "src/server/main.ts",
    "src/workbook/compute-worker.ts",
    "src/schools/demo/simulate-worker.ts",
  ],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  outbase: "src",
  outdir: "src",
  outExtension: { ".js": ".mjs" },
  logLevel: "warning",
  define: { __AMP_GUESS_CHANCES__: JSON.stringify(table) },
});
console.log(
  `server built with ${Object.keys(table).length} guessing chances in ${Math.round(performance.now() - started)} ms`,
);
