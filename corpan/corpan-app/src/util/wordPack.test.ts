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
let wordPackIdForPair: (nativeLang: string, targetLang: string) => string | null
let wordPackIdCandidates: (nativeLang: string, targetLang: string) => string[]
let devDownloadUrlForPack: (packId: string) => string

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
  wordPackIdForPair = mod.wordPackIdForPair
  wordPackIdCandidates = mod.wordPackIdCandidates
  devDownloadUrlForPack = mod.devDownloadUrlForPack
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

// The 53 published (native→en) pairs, verified against the live index.json.
const PUBLISHED_NATIVES = [
  "ar", "bg", "bn", "ca", "cs", "da", "de", "el", "es", "fa", "fi", "fr",
  "gu", "he", "hi", "hr", "hu", "id", "it", "ja", "jv", "kn", "ko-polite",
  "lt", "mr", "ms", "ne", "nl", "no", "pa-Arab", "pa-Guru", "pl", "pt-BR",
  "pt-PT", "ro", "ru", "sk", "sl", "sr", "su", "sv", "sw", "ta", "te", "th",
  "tl", "tr", "uk", "ur", "vi", "yue-Hant-HK", "zh-Hans", "zh-Hant",
] as const

test("packIdForNative maps every published native to its exact index id", () => {
  assert.equal(PUBLISHED_NATIVES.length, 53)
  for (const code of PUBLISHED_NATIVES) {
    const expected = `wordpan_${code.replace(/-/g, "_")}_en`
    assert.equal(packIdForNative(code), expected, `native ${code}`)
  }
  // Spot-check the tricky region/script/variant codes explicitly.
  assert.equal(packIdForNative("ko-polite"), "wordpan_ko_polite_en")
  assert.equal(packIdForNative("pt-BR"), "wordpan_pt_BR_en")
  assert.equal(packIdForNative("pt-PT"), "wordpan_pt_PT_en")
  assert.equal(packIdForNative("pa-Arab"), "wordpan_pa_Arab_en")
  assert.equal(packIdForNative("pa-Guru"), "wordpan_pa_Guru_en")
  assert.equal(packIdForNative("yue-Hant-HK"), "wordpan_yue_Hant_HK_en")
  assert.equal(packIdForNative("zh-Hans"), "wordpan_zh_Hans_en")
  assert.equal(packIdForNative("zh-Hant"), "wordpan_zh_Hant_en")
})

test("packIdForNative resolves base subtags and region-only bases", () => {
  // Base subtag of a published base language (es-MX → es).
  assert.equal(packIdForNative("es-MX"), "wordpan_es_en")
  assert.equal(packIdForNative("fr-CA"), "wordpan_fr_en")
  // Region-only bases whose only packs are flavors default to a variant.
  assert.equal(packIdForNative("pt"), "wordpan_pt_BR_en")
  assert.equal(packIdForNative("zh"), "wordpan_zh_Hans_en")
  assert.equal(packIdForNative("pa"), "wordpan_pa_Guru_en")
  assert.equal(packIdForNative("ko"), "wordpan_ko_polite_en")
  assert.equal(packIdForNative("yue"), "wordpan_yue_Hant_HK_en")
})

test("packIdForNative is null for unpublished natives (incl. en)", () => {
  assert.equal(packIdForNative("en"), null)
  assert.equal(packIdForNative("en-US"), null)
  assert.equal(packIdForNative(""), null)
  assert.equal(packIdForNative("xx"), null)
})

test("wordPackIdForPair is GENERIC over target — no en/es assumption", () => {
  // Published-today shape (target en).
  assert.equal(wordPackIdForPair("es", "en"), "wordpan_es_en")
  assert.equal(wordPackIdForPair("pt-BR", "en"), "wordpan_pt_BR_en")
  // Future non-en targets derive cleanly (54×53 fleet goal): en→fr, fr→de.
  assert.equal(wordPackIdForPair("en", "fr"), "wordpan_en_fr")
  assert.equal(wordPackIdForPair("fr", "de"), "wordpan_fr_de")
  assert.equal(wordPackIdForPair("zh-Hant", "ja"), "wordpan_zh_Hant_ja")
  // Degenerate / empty pairs → null (a language doesn't explain itself).
  assert.equal(wordPackIdForPair("es", "es"), null)
  assert.equal(wordPackIdForPair("es-MX", "es"), null)
  assert.equal(wordPackIdForPair("", "en"), null)
  assert.equal(wordPackIdForPair("es", ""), null)
})

test("wordPackIdCandidates walks specific→general on both sides", () => {
  // Exact pair only when both sides are already specific.
  assert.deepEqual(wordPackIdCandidates("es", "en"), ["wordpan_es_en"])
  // Base-subtag fallback on the native side (es-MX → es).
  assert.deepEqual(wordPackIdCandidates("es-MX", "en"), [
    "wordpan_es_MX_en",
    "wordpan_es_en",
  ])
  // Region-only base default (pt → pt-BR) is appended after the bare base.
  assert.deepEqual(wordPackIdCandidates("pt", "en"), [
    "wordpan_pt_en",
    "wordpan_pt_BR_en",
  ])
  // Non-en target stays generic; same-language combos are skipped.
  assert.deepEqual(wordPackIdCandidates("en", "fr"), ["wordpan_en_fr"])
  assert.deepEqual(wordPackIdCandidates("es", "es"), [])
})

test("devDownloadUrlForPack maps the underscore id to the hyphenated dev zip", () => {
  // Word packs ship from the S3 word-pack index in production; this helper is
  // only the dev-server (vite `/packs`) fallback. The id is underscore-
  // canonical; the zip stem is hyphenated.
  assert.equal(
    devDownloadUrlForPack("wordpan_es_en"),
    "/packs/wordpan/wordpan-es-en.zip",
  )
})
