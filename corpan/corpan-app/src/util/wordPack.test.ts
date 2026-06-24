// Tests for the word-pack native-first / English-fallback selector and the
// pair-pack id resolver. Run with: `npm test`.
//
// `wordPack.ts` imports `@tauri-apps/api/core` and reads `import.meta.env`, which
// the bare node strip-types loader can't handle. We bundle through esbuild (a
// dev dep) — the same approach `onboarding/resolveLanding.test.ts` uses — and
// exercise the REAL exports. `selectPreferred` / `packIdForNative` are pure and
// never call `invoke`, so bundling its import is harmless.

import { test, before } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"

type WordExplanation = { paragraph: string; languageCode: string }
let selectPreferred: (
  byLang: Map<string, string>,
  preferred: string[],
) => WordExplanation | null
let packIdForNative: (nativeLang: string) => string | null
let downloadUrlForPack: (packId: string) => string

before(async () => {
  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))
  const res = await build({
    entryPoints: [path.join(here, "wordPack.ts")],
    bundle: true,
    format: "esm",
    write: false,
    platform: "neutral",
    define: { "import.meta.env.DEV": "false" },
    tsconfig: path.join(here, "../../tsconfig.json"),
  })
  const code = res.outputFiles[0].text
  const mod = await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  )
  selectPreferred = mod.selectPreferred
  packIdForNative = mod.packIdForNative
  downloadUrlForPack = mod.downloadUrlForPack
})

test("selectPreferred picks the native language first", () => {
  const byLang = new Map([
    ["en", "EN paragraph"],
    ["es", "ES paragraph"],
  ])
  const got = selectPreferred(byLang, ["es", "en"])
  assert.equal(got?.languageCode, "es")
  assert.equal(got?.paragraph, "ES paragraph")
})

test("selectPreferred falls back to English when native is missing", () => {
  const byLang = new Map([["en", "EN paragraph"]])
  const got = selectPreferred(byLang, ["es", "fr"])
  assert.equal(got?.languageCode, "en")
  assert.equal(got?.paragraph, "EN paragraph")
})

test("selectPreferred returns null when nothing is available", () => {
  assert.equal(selectPreferred(new Map(), ["es", "en"]), null)
})

test("selectPreferred respects stack order before the en fallback", () => {
  const byLang = new Map([
    ["fr", "FR"],
    ["en", "EN"],
  ])
  const got = selectPreferred(byLang, ["es", "fr"])
  assert.equal(got?.languageCode, "fr")
})

test("packIdForNative maps es → wordpan_es_en and is null otherwise", () => {
  assert.equal(packIdForNative("es"), "wordpan_es_en")
  assert.equal(packIdForNative("es-MX"), "wordpan_es_en")
  assert.equal(packIdForNative("en"), null)
  assert.equal(packIdForNative("fr"), null)
})

test("downloadUrlForPack maps the underscore id back to the hyphenated zip", () => {
  // build with import.meta.env.DEV=false (see before()) → prod CDN URL.
  // The id is underscore-canonical, but the zip stem is hyphenated so the
  // installer's filename→id derivation lands back on `wordpan_es_en`.
  assert.equal(
    downloadUrlForPack("wordpan_es_en"),
    "https://encorpora.io/corpan/packs/wordpan-es-en.zip",
  )
})
