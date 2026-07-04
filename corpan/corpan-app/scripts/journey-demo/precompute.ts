// scripts/journey-demo/precompute.ts — build the browser-demo content bundle.
//
// Loads the REAL journey_en course pack (dja/journey_pack/dist) through the
// in-tree PackReader → CourseGraph loader (esbuild-bundled, the journey-sim
// w6Smoke precedent), joins the phrase corpus faces (en target + es native)
// from dja/release.sqlite3 and the in-repo phrase-pack sources, and emits
// ONE JSON file the browser demo's JSON-backed ResolverDeps port can serve:
//
//   corpan-app/public/journey-demo/course.json
//
// Run:  node --experimental-strip-types scripts/journey-demo/precompute.ts
// (Re-run after rebuilding the pack: python3 corpan/dja/journey_pack/build_journey_pack.py en)
//
// The output is a DEV ARTIFACT (gitignored — derived from the gitignored
// dist/ pack). Demo L1 is Spanish (es); the shipped strings table carries all
// 54 langs but the demo only ships en+es rows to stay small.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const here = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(here, "../..")
const COURSE_DB = path.resolve(APP, "../dja/journey_pack/dist/journey_en/data/course.sqlite3")
const RELEASE_DB = path.resolve(APP, "../dja/release.sqlite3")
const PHRASE_PACKS_DIR = path.resolve(APP, "../tools/phrase-packs")
const OUT = path.resolve(APP, "public/journey-demo/course.json")

const TARGET = "en"
const NATIVE = "es"
const RANDOM_POOL_SIZE = 160

type Row = Record<string, unknown>

function fail(msg: string): never {
  console.error(`[journey-demo precompute] ${msg}`)
  process.exit(1)
}

if (!fs.existsSync(COURSE_DB)) {
  fail(
    `real pack missing at ${COURSE_DB}\n  build it: python3 corpan/dja/journey_pack/build_journey_pack.py en`,
  )
}
if (!fs.existsSync(RELEASE_DB)) fail(`core corpus missing at ${RELEASE_DB}`)

/** Load the CourseGraph via the in-tree loader (journey-sim loadPackGraph
 *  precedent: esbuild-bundle util/journeyPack.ts — its module graph pulls
 *  @tauri-apps, which strip-types can't import directly). */
async function loadGraph(dbPath: string): Promise<Record<string, unknown>> {
  const { build } = await import("esbuild")
  const res = await build({
    entryPoints: [path.resolve(APP, "src/util/journeyPack.ts")],
    bundle: true,
    format: "esm",
    write: false,
    platform: "neutral",
    define: { "import.meta.env.DEV": "false" },
    tsconfig: path.resolve(APP, "tsconfig.json"),
  })
  const mod = (await import(
    "data:text/javascript;base64," + Buffer.from(res.outputFiles[0].text).toString("base64")
  )) as typeof import("../../src/util/journeyPack.ts")
  const db = new DatabaseSync(dbPath, { readOnly: true })
  const queryFn = async (sql: string, params: unknown[], maxRows: number) =>
    db.prepare(sql).all(...(params as never[])).slice(0, maxRows) as Row[]
  const graph = await mod.loadCourseGraph(queryFn)
  db.close()
  return graph as unknown as Record<string, unknown>
}

interface TranslationOut {
  language_code: string
  text: string
  romanization: string
}
interface EntryOut {
  entry_id: number
  level: string
  domains: string[]
  source: string
  translations: TranslationOut[]
}

async function main(): Promise<void> {
  const graph = await loadGraph(COURSE_DB)

  const course = new DatabaseSync(COURSE_DB, { readOnly: true })
  const items = course
    .prepare(
      "SELECT id, kind, source, ref_id, difficulty_b, intro_order FROM items ORDER BY intro_order",
    )
    .all() as Row[]
  const itemSkills = (
    course.prepare("SELECT item_id, skill_id FROM item_skills ORDER BY item_id, skill_id").all() as Row[]
  ).map((r) => [String(r.item_id), String(r.skill_id)])

  // strings: demo languages only (native-first walk needs es + en fallback)
  const stringRows = course
    .prepare("SELECT key, lang, text FROM strings WHERE lang IN (?, ?)")
    .all(TARGET, NATIVE) as Row[]
  const strings: Record<string, { lang: string; text: string }[]> = {}
  for (const r of stringRows) {
    ;(strings[String(r.key)] ??= []).push({ lang: String(r.lang), text: String(r.text) })
  }

  const grammarNodes: Record<string, Row> = {}
  for (const r of course
    .prepare("SELECT id, skill_id, cefr, title_key, note_key, late_acquired FROM grammar_nodes")
    .all() as Row[]) {
    grammarNodes[String(r.id)] = r
  }

  const l1Overlays = course
    .prepare(
      "SELECT l1, overlay_type, ref_kind, ref_id, payload_json, string_key FROM l1_overlays WHERE l1 = ?",
    )
    .all(NATIVE) as Row[]

  // ------------------------------------------------ phrase faces (EntryOut)
  const release = new DatabaseSync(RELEASE_DB, { readOnly: true })
  const langIds = new Map<string, number>()
  for (const r of release
    .prepare("SELECT id, code FROM cor_language WHERE code IN (?, ?)")
    .all(TARGET, NATIVE) as Row[]) {
    langIds.set(String(r.code), Number(r.id))
  }
  const domainByEntry = new Map<number, string[]>()
  for (const r of release
    .prepare(
      "SELECT ed.entry_id AS entry_id, d.code AS code FROM cor_entry_domains ed JOIN cor_domain d ON d.id = ed.domain_id",
    )
    .all() as Row[]) {
    const id = Number(r.entry_id)
    ;(domainByEntry.get(id) ?? domainByEntry.set(id, []).get(id)!).push(String(r.code))
  }

  const getEntry = release.prepare("SELECT id, level FROM cor_entry WHERE id = ?")
  const getTranslations = release.prepare(
    "SELECT language_id, text, romanization FROM cor_translation WHERE entry_id = ? AND language_id IN (?, ?)",
  )
  const enId = langIds.get(TARGET)!
  const esId = langIds.get(NATIVE)!

  function baseEntryOut(entryId: number): EntryOut | null {
    const e = getEntry.get(entryId) as Row | undefined
    if (!e) return null
    const translations: TranslationOut[] = []
    for (const t of getTranslations.all(entryId, enId, esId) as Row[]) {
      translations.push({
        language_code: Number(t.language_id) === enId ? TARGET : NATIVE,
        text: String(t.text),
        romanization: t.romanization == null ? "" : String(t.romanization),
      })
    }
    if (!translations.some((t) => t.language_code === TARGET)) return null
    return {
      entry_id: entryId,
      level: String(e.level),
      domains: domainByEntry.get(entryId) ?? [],
      source: "base",
      translations,
    }
  }

  const entries: Record<string, EntryOut> = {}
  const baseIds = new Set<number>()
  let phrasePackFaces = 0
  const phrasePackSources = new Set<string>()

  for (const it of items) {
    if (String(it.kind) !== "phrase") continue
    const source = String(it.source)
    const refId = String(it.ref_id)
    if (source === "base") {
      const id = Number(refId)
      baseIds.add(id)
      const out = baseEntryOut(id)
      if (!out) fail(`base entry ${id} unresolvable in ${RELEASE_DB}`)
      entries[`base:${refId}`] = out
    } else {
      phrasePackSources.add(source)
    }
  }

  // Phrase-pack sources: in-repo phrases.json is the authored truth (index =
  // ref_id). Translations ride translations/<lang>.json when authored; the
  // two journey_en sources are en-only today — the native face is honestly
  // absent (resolvePhrase only requires the target face).
  for (const source of phrasePackSources) {
    const dir = path.join(PHRASE_PACKS_DIR, source)
    const phrasesPath = path.join(dir, "phrases.json")
    if (!fs.existsSync(phrasesPath)) fail(`phrase pack source missing: ${phrasesPath}`)
    const phrases = JSON.parse(fs.readFileSync(phrasesPath, "utf-8")) as Array<{
      english?: string
      text?: string
      level?: string
    }>
    const esPath = path.join(dir, "translations", `${NATIVE}.json`)
    const esByIndex: Record<string, string> = fs.existsSync(esPath)
      ? (JSON.parse(fs.readFileSync(esPath, "utf-8")) as Record<string, string>)
      : {}
    for (const it of items) {
      if (String(it.kind) !== "phrase" || String(it.source) !== source) continue
      const idx = Number(it.ref_id)
      const p = phrases[idx]
      if (!p) fail(`${source} phrase index ${idx} out of range`)
      const translations: TranslationOut[] = [
        { language_code: TARGET, text: String(p.text ?? p.english ?? ""), romanization: "" },
      ]
      const es = esByIndex[String(idx)]
      if (es) translations.push({ language_code: NATIVE, text: es, romanization: "" })
      entries[`${source}:${it.ref_id}`] = {
        entry_id: idx,
        level: String(p.level ?? "A1"),
        domains: [source],
        source,
        translations,
      }
      phrasePackFaces += 1
    }
  }

  // Random top-up pool (resolver rung 3): a deterministic stride sample of
  // base entries OUTSIDE the course, both demo faces present.
  const allIds = (release.prepare("SELECT id FROM cor_entry ORDER BY id").all() as Row[]).map(
    (r) => Number(r.id),
  )
  const candidates = allIds.filter((id) => !baseIds.has(id))
  const stride = Math.max(1, Math.floor(candidates.length / RANDOM_POOL_SIZE))
  const randomPool: EntryOut[] = []
  for (let i = 0; i < candidates.length && randomPool.length < RANDOM_POOL_SIZE; i += stride) {
    const out = baseEntryOut(candidates[i])
    if (out && out.translations.length === 2) randomPool.push(out)
  }

  course.close()
  release.close()

  const data = {
    manifest: {
      generatedFrom: path.relative(path.resolve(APP, "../.."), COURSE_DB),
      generatedAt: new Date().toISOString(),
      courseId: String(graph.courseId),
      targetLang: TARGET,
      nativeLang: NATIVE,
      itemCount: items.length,
      entryCount: Object.keys(entries).length,
      stringKeyCount: Object.keys(strings).length,
      grammarNodeCount: Object.keys(grammarNodes).length,
      overlayCount: l1Overlays.length,
      randomPoolCount: randomPool.length,
    },
    graph,
    tables: { strings, grammarNodes, l1Overlays, items, itemSkills },
    entries,
    randomPool,
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  const json = JSON.stringify(data)
  fs.writeFileSync(OUT, json)
  console.log(`[journey-demo precompute] wrote ${OUT}`)
  console.log(
    `  course=${data.manifest.courseId} items=${items.length} ` +
      `(phrase base=${baseIds.size}, phrase pack faces=${phrasePackFaces}) ` +
      `entries=${data.manifest.entryCount} stringKeys=${data.manifest.stringKeyCount} ` +
      `grammarNodes=${data.manifest.grammarNodeCount} overlays=${l1Overlays.length} ` +
      `randomPool=${randomPool.length}`,
  )
  console.log(`  size=${(json.length / 1024 / 1024).toFixed(2)} MB`)
}

await main()
