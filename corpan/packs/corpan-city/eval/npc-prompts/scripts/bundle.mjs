/**
 * bundle.mjs — bundle compose.ts (which imports the REAL prompt machinery) into
 * a single runnable ESM file, resolving the `@corpan-city/contracts` alias the
 * pack's tsconfig defines. Output → out/compose.mjs, run with `node` to emit the
 * cell matrix.
 */
import { build } from "esbuild"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const pack = resolve(here, "..", "..", "..") // packs/corpan-city
const out = resolve(here, "..", "out")

await build({
  entryPoints: [resolve(here, "..", "compose.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile: resolve(out, "compose.mjs"),
  alias: {
    "@corpan-city/contracts": resolve(pack, "contracts", "src", "index.ts"),
  },
  logLevel: "info",
})

console.log("bundled → out/compose.mjs")
