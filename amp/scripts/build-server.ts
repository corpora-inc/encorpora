/** Bundles the API and its workbook worker as production runs them. Guessing
 * chances are computed here, once per image, so no pod pays for them while a
 * learner waits. Both come from the same source, so they cannot disagree.
 * The demo's simulation is not bundled: its terms ship precomputed
 * (`src/schools/demo/snapshot.ts`), so no pod ever simulates one
 * (`tests/demo-terms.test.ts` builds with these options to prove it). */
import { pathToFileURL } from "node:url";
import { build, type BuildOptions } from "esbuild";
import { guessChanceTable } from "../src/math/guess-chance";

export const serverBuildOptions = (
  guessChances: Record<string, number>,
): BuildOptions => ({
  entryPoints: ["src/server/main.ts", "src/workbook/compute-worker.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  outbase: "src",
  outdir: "src",
  outExtension: { ".js": ".mjs" },
  logLevel: "warning",
  define: { __AMP_GUESS_CHANCES__: JSON.stringify(guessChances) },
});

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const started = performance.now();
  const table = guessChanceTable();
  await build(serverBuildOptions(table));
  console.log(
    `server built with ${Object.keys(table).length} guessing chances in ${Math.round(performance.now() - started)} ms`,
  );
}
