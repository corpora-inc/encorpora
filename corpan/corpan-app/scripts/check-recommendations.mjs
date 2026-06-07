import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"

import { build } from "esbuild"

const appRoot = fileURLToPath(new URL("..", import.meta.url))
const result = await build({
  absWorkingDir: appRoot,
  entryPoints: ["src/experiences/registry.ts"],
  bundle: true,
  format: "esm",
  logLevel: "silent",
  platform: "node",
  write: false,
})
const moduleUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`
const { rankExperiences, resolveExperienceMeta } = await import(moduleUrl)

const learner = {
  userClass: "learner",
  ageBand: "adult",
  userLanguages: ["en", "es"],
}

const topFor = (interests, ratings) =>
  rankExperiences({ ...learner, interests, ratings })[0]?.id

assert.equal(topFor(["games"]), "corpan_city")
assert.equal(topFor(["study"]), "tutomaton")
assert.equal(topFor(["speak"]), "tutomaton")
assert.equal(topFor(["study", "speak"]), "tutomaton")

// Curation only applies to an interest the user explicitly selected.
assert.equal(topFor([]), "earthgate_reader")

// Explicit user feedback remains stronger than the curated interest boost.
assert.equal(topFor(["games"], { corpan_city: -1 }), "hover_runner")

const catalogMeta = resolveExperienceMeta("catalog_only", {
  id: "catalog_only",
  categories: ["games"],
  featuredFor: ["games"],
})
assert.deepEqual(catalogMeta.featuredFor, ["games"])

console.log("Recommendation ranking checks passed.")
