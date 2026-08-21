/**
 * etymology unit test — the Drift word-ORIGIN lookup (DRIFT 0.3.0: the CTO's
 * "etymologies of all the words" ask). Drives the REAL etymology.ts headless via
 * esbuild (mirrors challenge.spec.mjs), with a FAKE hostApi in place of the real
 * `queryPackDb`/`content_packs_query_db` seam.
 *
 * Proves:
 *   (a) wordPackIdCandidates derives `wordpan_<native>_en` ids (+ base fallback),
 *       and never mints an en-word pack for an English native;
 *   (b) selectPreferred is native-first with an English fallback;
 *   (c) the resolver is CAPABILITY-GATED: no queryPackDb ⇒ disabled ⇒ null;
 *   (d) it only applies when the TARGET word is English (en→es target ⇒ disabled);
 *   (e) a real hit resolves + caches the answering pack id (probes once);
 *   (f) an uninstalled pack (query rejects) degrades to null, not a throw.
 *
 * Run:  node test/etymology.spec.mjs   (node >= 18)
 */

import { fileURLToPath } from "node:url"
import path from "node:path"
import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"

const here = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.join(here, "..")
const src = path.join(packRoot, "src")

let failures = 0
const fail = (m) => { console.error("FAIL:", m); failures++ }
const ok = (m) => console.log("OK  ", m)
const assert = (cond, m) => { if (cond) ok(m); else fail(m) }

const { build } = await import("esbuild")

async function bundleAndImport(entryText) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "drift-etym-test-"))
  const entry = path.join(dir, "entry.ts")
  writeFileSync(entry, entryText)
  const res = await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    write: false,
    platform: "node",
    absWorkingDir: dir,
  })
  const code = res.outputFiles[0].text
  const mod = path.join(dir, "out.mjs")
  writeFileSync(mod, code)
  return await import(mod + "?t=" + Date.now())
}

const mod = await bundleAndImport(`
  export * from ${JSON.stringify(path.join(src, "etymology.ts"))}
`)

const { wordPackIdCandidates, selectPreferred, baseSubtag, EtymologyResolver } = mod

// --- fake host: an installed pack keyed by id → { word → {lang: paragraph} } --
function fakeHost(installed, opts = {}) {
  const calls = []
  return {
    calls,
    speak: () => {},
    getStackConfig: () => ({ languages: ["es", "en"], domains: [], levels: [], rate: 1, textSize: "m", showRomanization: false }),
    ...(opts.noQuery ? {} : {
      queryPackDb: async ({ packId, params }) => {
        calls.push(packId)
        const db = installed[packId]
        if (!db) throw new Error("Pack not installed: " + packId) // real host rejects
        const byWord = db[String(params?.[0] ?? "")] ?? {}
        return {
          columns: ["language_code", "paragraph"],
          rows: Object.entries(byWord).map(([language_code, paragraph]) => ({ language_code, paragraph })),
        }
      },
    }),
  }
}

// --- (a) id derivation ------------------------------------------------------
assert(
  JSON.stringify(wordPackIdCandidates("es")) === JSON.stringify(["wordpan_es_en"]),
  "(a) es → [wordpan_es_en]",
)
assert(
  JSON.stringify(wordPackIdCandidates("pt-BR")) === JSON.stringify(["wordpan_pt_BR_en", "wordpan_pt_en"]),
  "(a) pt-BR → exact then base fallback",
)
assert(wordPackIdCandidates("en").length === 0, "(a) en native → no en-word pack")
assert(baseSubtag("zh-Hans") === "zh", "(a) baseSubtag strips subtags")

// --- (b) native-first selection --------------------------------------------
const sel = selectPreferred(new Map([["en", "E"], ["es", "S"]]), ["es"])
assert(sel && sel.lang === "es" && sel.paragraph === "S", "(b) native (es) preferred over en")
const selFallback = selectPreferred(new Map([["en", "E"]]), ["es"])
assert(selFallback && selFallback.lang === "en", "(b) falls back to en")
assert(selectPreferred(new Map(), ["es"]) === null, "(b) empty map ⇒ null")

// --- (c) capability gate ----------------------------------------------------
{
  const host = fakeHost({}, { noQuery: true })
  const r = new EtymologyResolver(host, { targetLang: "en", nativeLang: "es" })
  assert(!r.enabled, "(c) no queryPackDb ⇒ resolver disabled")
  assert((await r.lookup("run")) === null, "(c) disabled ⇒ lookup null")
}

// --- (d) target-language gate (en→es: tapped word is Spanish) ---------------
{
  const host = fakeHost({ wordpan_es_en: { run: { es: "correr…" } } })
  const r = new EtymologyResolver(host, { targetLang: "es", nativeLang: "en" })
  assert(!r.enabled, "(d) non-English target ⇒ disabled (word packs key English)")
  assert((await r.lookup("mesa")) === null, "(d) disabled ⇒ null, no query issued")
  assert(host.calls.length === 0, "(d) no query attempted for non-English target")
}

// --- (e) real hit + pack caching (es native learning English) ---------------
{
  const host = fakeHost({
    wordpan_es_en: {
      running: { es: "Correr significa… del inglés antiguo rinnan.", en: "Running means…" },
    },
  })
  const r = new EtymologyResolver(host, { targetLang: "en", nativeLang: "es" })
  assert(r.enabled, "(e) English target + queryPackDb ⇒ enabled")
  const hit = await r.lookup("Running") // case-folded to 'running'
  assert(hit && hit.lang === "es" && /rinnan/.test(hit.paragraph), "(e) resolves native-language origin")
  await r.lookup("running")
  // second lookup reuses the resolved pack id — still just the one candidate here,
  // but the resolved-id path must not re-scan candidates.
  assert(host.calls.every((c) => c === "wordpan_es_en"), "(e) only ever queries the resolved pack")
}

// --- (f) uninstalled pack ⇒ graceful null ----------------------------------
{
  const host = fakeHost({}) // nothing installed → queryPackDb rejects
  const r = new EtymologyResolver(host, { targetLang: "en", nativeLang: "es" })
  let threw = false
  let out
  try { out = await r.lookup("running") } catch { threw = true }
  assert(!threw && out === null, "(f) rejecting query degrades to null, never throws")
}

if (failures > 0) {
  console.error(`\n${failures} etymology assertion(s) failed`)
  process.exit(1)
}
console.log("\nAll etymology assertions passed")
