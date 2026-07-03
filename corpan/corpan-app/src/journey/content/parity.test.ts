// Cross-module parity tripwires (content-resolver.md §2.8, §3.3).
//
// Two contracts the resolver mirrors instead of importing at runtime:
//   1. util/wordPack.ts::selectPreferred — its module graph pulls
//      @tauri-apps/api, which the bare strip-types loader can't load, so
//      resolve.ts carries `pickPreferred` with the same walk. This test
//      esbuild-bundles the REAL selectPreferred (the same pattern as
//      wordPack.test.ts) and pins the two on a case table.
//   2. contentPacks/activitySchemas.ts::ActivityResultSchema — the §3.3
//      missing-content envelope must validate at the host boundary.

import { test, before } from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { contentMissingResult, pickPreferred } from "./resolve.ts"

type WordExplanation = { paragraph: string; languageCode: string }
let selectPreferred: (
  byLang: Map<string, string>,
  preferred: string[],
) => WordExplanation | null
let parseActivityResult: (raw: unknown) => unknown

before(async () => {
  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))
  const bundle = async (entry: string) => {
    const res = await build({
      entryPoints: [entry],
      bundle: true,
      format: "esm",
      write: false,
      platform: "neutral",
      define: { "import.meta.env.DEV": "false" },
      tsconfig: path.join(here, "../../../tsconfig.json"),
    })
    const code = res.outputFiles[0].text
    return import("data:text/javascript;base64," + Buffer.from(code).toString("base64"))
  }
  const wordPack = await bundle(path.join(here, "../../util/wordPack.ts"))
  selectPreferred = wordPack.selectPreferred
  const schemas = await bundle(path.join(here, "../../contentPacks/activitySchemas.ts"))
  parseActivityResult = (raw) => schemas.ActivityResultSchema.parse(raw)
})

test("pickPreferred matches the real selectPreferred on a case table", () => {
  const cases: Array<{ byLang: Map<string, string>; preferred: string[] }> = [
    { byLang: new Map([["en", "EN"], ["es", "ES"]]), preferred: ["es", "en"] },
    { byLang: new Map([["en", "EN"]]), preferred: ["es", "fr"] },
    { byLang: new Map([["fr", "FR"], ["en", "EN"]]), preferred: ["es", "fr"] },
    { byLang: new Map([["de", "DE"]]), preferred: ["es"] }, // last-resort any
    { byLang: new Map(), preferred: ["es", "en"] },
    { byLang: new Map([["es", "ES"]]), preferred: [] },
    { byLang: new Map([["en", "EN"], ["zh", "ZH"]]), preferred: ["zh", "zh", ""] },
  ]
  for (const c of cases) {
    const theirs = selectPreferred(c.byLang, c.preferred)
    const ours = pickPreferred(c.byLang, c.preferred)
    assert.equal(ours?.text ?? null, theirs?.paragraph ?? null)
    assert.equal(ours?.lang ?? null, theirs?.languageCode ?? null)
  }
})

test("the §3.3 missing-content envelope validates against ActivityResultSchema", () => {
  const envelope = contentMissingResult("js-1700000000-ab12")
  const parsed = parseActivityResult(envelope) as {
    abandoned: boolean
    detail?: { flags?: Record<string, boolean> }
  }
  assert.equal(parsed.abandoned, true)
  assert.equal(parsed.detail?.flags?.contentMissing, true)
})
