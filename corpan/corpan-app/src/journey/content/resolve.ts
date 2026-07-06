// ============================================================
// Journey content resolver — the seam between ADDRESSES and CONTENT.
// Spec: corpan/docs/journey/specs/content-resolver.md (R14).
//
// The engine schedules ItemRefs; renderers need text, translations,
// romanization, and audio. This module is everything in between.
//
// Hard boundaries (spec §0):
//   1. No engine imports (journey/engine/** is a closed barrel).
//   2. Dependency-injected IO — no hostApi/Tauri imports here; the runtime
//      wires ResolverDeps from createHostApi(), tests wire fixtures.
//   3. Read-only, offline, local. No network at resolve time.
//   4. No unseeded randomness (Math.random is banned; see rng.ts).
//   5. Never a blank card: unresolvable refs land in `missing`; the runtime
//      drops the card PRE-MOUNT and reports the §3.3 envelope
//      (see contentMissingResult below).
// ============================================================

import {
  itemRefKey,
  type ItemRef,
  type ItemRefKind,
  type ActivityResult,
} from "../../contentPacks/activityContract.ts"
import type { EntryOut } from "../../contentPacks/types.ts"
import { LruCache, SharedBytePool } from "./cache.ts"
import { fnv1a32, mulberry32 } from "./rng.ts"

// ------------------------------------------------------------- ResolvedItem

/** One face of an item in one language. */
export interface ResolvedText {
  /** Display truth — what the renderer prints. */
  text: string
  /**
   * What gets spoken. Diverges from `text` ONLY where the source corpus
   * diverges (segments carry tts.text); for every other kind
   * ttsText === text. Renderers speak ttsText, print text — never the
   * reverse (house tts.text rule).
   */
  ttsText: string
  /** Optional (pinyin etc.) — rendered per stack showRomanization. */
  romanization?: string
}

export type ResolvedExtras =
  | { kind: "phrase"; source: string; domains: string[] }
  | {
      kind: "word"
      /** wordpan ~50-word paragraph in the learner's NATIVE language, when
       *  the (native→target) wordpan pair pack is installed. The only
       *  native-side content that exists for words (there is NO
       *  word-translation table anywhere). */
      explanationNative?: string
      /** Same paragraph in the TARGET language, when present in the pair DB. */
      explanationTarget?: string
    }
  | {
      kind: "char"
      pinyin: string
      strokeCount: number
      radical?: string
      frequency?: number
      /** Etymology summary, native-first selection (§2.8). */
      etymology?: string
      // HanziWriter stroke JSON is LAZY: resolveCharStrokes() only (§2.3).
    }
  | {
      kind: "segment"
      bookId: string
      chapter: number
      blockType: "heading" | "text"
      pauseAfterMs?: number
    }
  | {
      kind: "grammarNode"
      title: string
      /** The ≤60s rule-card copy, L1-selected (§2.8). */
      note: string
      lateAcquired: boolean
      /** Exemplar phrases carrying the node, resolved (§2.5). */
      exemplars: ResolvedItem[]
    }
  | {
      kind: "phoneme"
      /** Sorted-IPA form, e.g. "iː-ɪ". */
      contrast: string
      /** From l1_overlays phoneme_pair payload for the active L1. */
      minimalPairs: [string, string][]
    }
  | { kind: "concept"; imageSrc?: string } // imagepan — absent in v0.1 (D10.6)

export interface ResolvedItem {
  ref: ItemRef
  /** itemRefKey(ref) — `<kind>:<source>:<id>` per R2. Cache + dedup key. */
  key: string
  kind: ItemRefKind
  /** Target-language face. ALWAYS present — absence means the item did not
   *  resolve (it lands in `missing`, never here). */
  target: ResolvedText
  /** Native-language face. Absent on single-language stacks, when the source
   *  corpus has no native-language row (word/char/segment), or when the
   *  translation row is missing. */
  native?: ResolvedText
  /** CEFR band where the source carries one (phrase kinds, grammar nodes). */
  level?: string
  /** Pre-rendered audio. v0.1: `segment` kind only. Word timestamps are
   *  against DISPLAY text (audio_manifest contract). */
  audio?: {
    src: string
    durationMs: number
    words?: { word: string; startMs: number; endMs: number }[]
  }
  /** Per-kind payload, discriminated on `kind`. */
  extras?: ResolvedExtras
}

// -------------------------------------------------------------- Module API

export type MissingReason =
  | "pack_not_installed"
  | "row_absent"
  | "translation_absent"
  | "file_absent"
  | "preview_truncated"
  | "db_error"

export interface ResolveOutcome {
  /** Spec order preserved. */
  resolved: ResolvedItem[]
  missing: { ref: ItemRef; reason: MissingReason }[]
}

export interface PackDbResult {
  columns: string[]
  rows: Record<string, unknown>[]
}

/**
 * Dependency-injected IO surface (spec §3.1). Wired from createHostApi()
 * by runtime.ts; from fixtures in tests. Shapes mirror the REAL host
 * surfaces so integration wiring is 1:1:
 *   getEntryById       → hostApi.getEntryById (catch not-found → null)
 *   getRandomEntries   → hostApi.getRandomEntriesFiltered
 *   queryPackDb        → hostApi.queryPackDb (rows are column-keyed records,
 *                        matching content_packs_query_db — the spec sketch's
 *                        unknown[][] is corrected here to the real shape)
 *   fetchPackText      → content_packs_fetch_text over a corpan-pack:// URL
 *   packFileUrl        → corpan-pack:// URL builder for a pack-relative path
 *   findInstalledWordPack   → findWordPackForPair + installed registry
 *   findInstalledNarrationPack → catalog-v2 installed registry
 *   log                → local analytics AppendLog (storage-analytics.md);
 *                        console fallback until W1 wiring
 */
export interface ResolverDeps {
  getEntryById(entryId: number, source: string): Promise<EntryOut | null>
  getRandomEntries(q: {
    count: number
    domains?: string[]
    levels?: string[]
  }): Promise<EntryOut[]>
  queryPackDb(q: {
    packId: string
    dbName?: string
    sql: string
    params?: unknown[]
    maxRows?: number
  }): Promise<PackDbResult>
  fetchPackText(packId: string, relPath: string): Promise<string>
  packFileUrl(packId: string, relPath: string): string
  findInstalledWordPack(nativeLang: string, targetLang: string): string | null
  findInstalledNarrationPack(bookId: string, lang: string): string | null
  findInstalledPack(packId: string): boolean
  /** Structured event log (journey_content_missing, truncation warnings…). */
  log?(event: string, data: Record<string, unknown>): void
}

export interface ResolveContext {
  courseId: string // 'journey_en'
  targetLang: string
  nativeLang?: string // absent on single-language stacks
}

/** One course-pack `items` row, as the distractor sampler consumes it. */
export interface DistractorCandidateRow {
  /** Serialized ItemRef (course-pack items.id). */
  id: string
  kind: ItemRefKind
  source: string
  refId: string
  /** Static IRT difficulty; null for rung-3 random top-ups. */
  b: number | null
}

export interface Resolver {
  resolveItems(refs: ItemRef[]): Promise<ResolveOutcome>
  /** §2.3 lazy path — HanziWriter stroke JSON, own small LRU. */
  resolveCharStrokes(char: string): Promise<unknown | null>
  /** Session end / stack switch / pack install events (§3.2). */
  invalidate(): void
  /** @internal distractor candidate-ROW cache (§3.2, 32 entries) — owned
   *  here so invalidate() clears it; consumed only by distractors.ts.
   *  Resolved distractor SETS are never cached (recent-window-dependent). */
  poolCacheGet(key: string): DistractorCandidateRow[] | undefined
  /** @internal */
  poolCacheSet(key: string, rows: DistractorCandidateRow[]): void
}

// ------------------------------------------------------- SQL (one registry)
//
// R7 truncation rule: the Rust layer hard-caps at 2,000 rows and truncates
// SILENTLY — every query here carries an explicit LIMIT, is issued with
// maxRows === that LIMIT, and a full page logs a truncation warning.
// The static test asserts every string matches /LIMIT \d+/.

export const SQL = {
  wordExplanation:
    "SELECT language_code, paragraph FROM word_explanation WHERE word = ? LIMIT 60",
  hanziChar:
    "SELECT pinyin, stroke_count, radical, frequency FROM hanzi_character WHERE char = ? LIMIT 1",
  hanziEtymology:
    "SELECT language_code, summary FROM hanzi_etymology WHERE char = ? LIMIT 60",
  hanziStrokes:
    "SELECT data_json FROM hanzi_writer WHERE char = ? LIMIT 1",
  grammarNode:
    "SELECT id, skill_id, cefr, title_key, note_key, late_acquired FROM grammar_nodes WHERE id = ? LIMIT 1",
  grammarExemplars:
    "SELECT i.id, i.kind, i.source, i.ref_id FROM item_skills js JOIN items i ON i.id = js.item_id " +
    "WHERE js.skill_id = ? AND i.kind = 'phrase' ORDER BY i.intro_order LIMIT 8",
  phonemeOverlay:
    "SELECT payload_json, string_key FROM l1_overlays WHERE l1 = ? AND overlay_type = 'phoneme_pair' " +
    "AND ref_kind = 'item' AND ref_id = ? LIMIT 1",
  strings: "SELECT lang, text FROM strings WHERE key = ? LIMIT 60",
} as const

export function sqlLimit(sql: string): number {
  const m = /LIMIT (\d+)\b/.exec(sql)
  if (!m) throw new Error(`resolver SQL without LIMIT: ${sql}`)
  return Number(m[1])
}

// ------------------------------------------------- preference walk (§2.8)
//
// Native-first / English-fallback selection — the SAME contract as
// util/wordPack.ts::selectPreferred (which we cannot import at runtime:
// its module graph pulls @tauri-apps/api, which the headless test loader
// can't load). A parity test (resolve.selector.test.ts) pins this copy to
// the real selectPreferred so the contract can't silently drift.

export function pickPreferred(
  byLang: Map<string, string>,
  preferred: string[],
): { text: string; lang: string } | null {
  if (byLang.size === 0) return null
  const seen = new Set<string>()
  const order = [...preferred, "en"].filter((l) => {
    if (!l || seen.has(l)) return false
    seen.add(l)
    return true
  })
  for (const lang of order) {
    const text = byLang.get(lang)
    if (text) return { text, lang }
  }
  const [lang, text] = byLang.entries().next().value as [string, string]
  return { text, lang }
}

// ---------------------------------------------- §3.3 missing-card envelope

/**
 * The exact ActivityResult the runtime submits when a card is dropped
 * pre-mount for missing content (spec §3.3): no FSRS grade, no θ update,
 * and the engine adds the spec's itemRefKeys to the session exclusion set
 * (unlike plain `abandoned`, which returns items to their pools).
 */
export function contentMissingResult(specId: string): ActivityResult {
  return {
    specId,
    score: 0,
    perItem: [],
    durationMs: 0,
    abandoned: true,
    detail: { flags: { contentMissing: true } },
  }
}

// ------------------------------------------------------- segment file types

interface SegmentRow {
  id: string
  chapter?: number
  block_type?: string
  heading_level?: number
  text?: string
  tts?: { text?: string; pause_after_ms?: number }
}

interface SegmentsJson {
  total_segments?: number
  is_preview?: boolean
  segments: SegmentRow[]
}

interface ManifestSegment {
  file: string
  duration_ms: number
  pause_after_ms?: number
  words?: { word: string; start_ms: number; end_ms: number }[]
}

interface SegmentFileMaps {
  segments: SegmentsJson
  manifest: Record<string, ManifestSegment> | null
}

// ---------------------------------------------------------------- resolver

export function createResolver(deps: ResolverDeps, ctx: ResolveContext): Resolver {
  const log = deps.log ?? ((event, data) => console.info(event, data))

  // §3.2 cache table. items + segment file maps share the ~4 MB byte pool.
  const pool = new SharedBytePool(4 * 1024 * 1024)
  const items = new LruCache<ResolvedItem>({ maxEntries: 500, pool })
  const strings = new LruCache<string | null>({ maxEntries: 2000 })
  // Native-ONLY string lookups (word glosses, §2.2). Keyed by (lang, key) so
  // the same key resolves independently per language with NO en fallback.
  const stringsByLang = new LruCache<string | null>({ maxEntries: 2000 })
  const segmentFiles = new LruCache<SegmentFileMaps>({ maxEntries: 4, pool })
  const charStrokes = new LruCache<unknown>({ maxEntries: 50 })
  const distractorPools = new LruCache<DistractorCandidateRow[]>({ maxEntries: 32 })

  async function query(
    packId: string,
    sql: string,
    params: unknown[],
  ): Promise<Record<string, unknown>[]> {
    const limit = sqlLimit(sql)
    const out = await deps.queryPackDb({ packId, sql, params, maxRows: limit })
    // A full page means the silent Rust cap may have bitten (R7). LIMIT 1
    // point lookups are exempt — a hit there is a full page by definition.
    if (limit > 1 && out.rows.length === limit) {
      log("journey_content_truncation", { packId, sql, limit })
    }
    return out.rows
  }

  // ------------------------------------------------------ strings selector

  async function getString(key: string): Promise<string | null> {
    const cacheKey = `${ctx.courseId} ${key}`
    if (strings.has(cacheKey)) return strings.get(cacheKey) ?? null
    const rows = await query(ctx.courseId, SQL.strings, [key])
    const byLang = new Map<string, string>()
    for (const r of rows) {
      const lang = String(r.lang ?? "")
      const text = String(r.text ?? "")
      if (lang && text) byLang.set(lang, text)
    }
    const preferred = [ctx.nativeLang, ctx.targetLang].filter(
      (l): l is string => !!l,
    )
    const picked = pickPreferred(byLang, preferred)
    const value = picked ? picked.text : null
    strings.set(cacheKey, value)
    return value
  }

  /**
   * Native-ONLY string lookup — returns the `lang` row of `key` verbatim, or
   * null when that exact language row is absent. Deliberately does NOT walk the
   * en fallback (unlike getString): word glosses (`wg.<word>`) are the native
   * FACE of an exercise, and falling back to English would render an ES learner
   * an English→English word card (contract #1). Absent ⇒ native stays undefined
   * and the runtime guard reroutes the card.
   */
  async function getStringForLang(key: string, lang: string): Promise<string | null> {
    const cacheKey = `${ctx.courseId} ${lang} ${key}`
    if (stringsByLang.has(cacheKey)) return stringsByLang.get(cacheKey) ?? null
    const rows = await query(ctx.courseId, SQL.strings, [key])
    let value: string | null = null
    for (const r of rows) {
      if (String(r.lang ?? "") === lang) {
        value = String(r.text ?? "") || null
        break
      }
    }
    stringsByLang.set(cacheKey, value)
    return value
  }

  // -------------------------------------------------------- per-kind logic

  type OneOutcome =
    | { ok: true; item: ResolvedItem }
    | { ok: false; reason: MissingReason }

  function miss(reason: MissingReason): OneOutcome {
    return { ok: false, reason }
  }

  async function resolvePhrase(ref: ItemRef): Promise<OneOutcome> {
    if (ref.source !== "base" && !deps.findInstalledPack(ref.source)) {
      return miss("pack_not_installed")
    }
    const out = await deps.getEntryById(Number(ref.id), ref.source)
    if (!out) return miss("row_absent")
    const face = (lang: string): ResolvedText | undefined => {
      const row = out.translations.find((t) => t.language_code === lang)
      if (!row) return undefined
      const text: ResolvedText = { text: row.text, ttsText: row.text }
      if (row.romanization) text.romanization = row.romanization
      return text
    }
    const target = face(ctx.targetLang)
    // Base corpus is full-coverage, so this fires only on malformed phrase
    // packs — handled, not assumed away (§2.1).
    if (!target) return miss("translation_absent")
    const item: ResolvedItem = {
      ref,
      key: itemRefKey(ref),
      kind: "phrase",
      target,
      level: out.level,
      extras: { kind: "phrase", source: out.source ?? ref.source, domains: out.domains },
    }
    const native = ctx.nativeLang ? face(ctx.nativeLang) : undefined
    if (native) item.native = native
    return { ok: true, item }
  }

  async function resolveWord(ref: ItemRef): Promise<OneOutcome> {
    // The word IS the content: it never hard-misses on wordpan (§2.2).
    const item: ResolvedItem = {
      ref,
      key: itemRefKey(ref),
      kind: "word",
      target: { text: ref.id, ttsText: ref.id },
    }
    // Native FACE = the course-pack word gloss `wg.<word>` at nativeLang, via a
    // native-ONLY lookup (no en fallback — contract #1). This is what lets an ES
    // learner see ship→"el barco" instead of an English→English card. Absent ⇒
    // native stays undefined and the runtime guard reroutes the card. (Distinct
    // from the wordpan explanation paragraph below, which feeds long-press
    // gems, not the exercise face.)
    if (ctx.nativeLang) {
      const gloss = await getStringForLang(`wg.${ref.id}`, ctx.nativeLang)
      if (gloss) item.native = { text: gloss, ttsText: gloss }
    }
    const packId = ctx.nativeLang
      ? deps.findInstalledWordPack(ctx.nativeLang, ctx.targetLang)
      : null
    if (packId) {
      try {
        const rows = await query(packId, SQL.wordExplanation, [ref.id])
        const byLang = new Map<string, string>()
        for (const r of rows) {
          byLang.set(String(r.language_code ?? ""), String(r.paragraph ?? ""))
        }
        const explanationNative = ctx.nativeLang ? byLang.get(ctx.nativeLang) : undefined
        const explanationTarget = byLang.get(ctx.targetLang)
        if (explanationNative || explanationTarget) {
          const extras: ResolvedExtras = { kind: "word" }
          if (explanationNative) extras.explanationNative = explanationNative
          if (explanationTarget) extras.explanationTarget = explanationTarget
          item.extras = extras
        }
      } catch (err) {
        // Extras degrade; the word still resolves (§2.2).
        log("journey_content_word_extras_error", {
          word: ref.id,
          packId,
          error: String(err),
        })
      }
    }
    return { ok: true, item }
  }

  async function resolveChar(ref: ItemRef): Promise<OneOutcome> {
    if (!deps.findInstalledPack("hanzipan")) return miss("pack_not_installed")
    const rows = await query("hanzipan", SQL.hanziChar, [ref.id])
    if (rows.length === 0) return miss("row_absent")
    const row = rows[0]
    const extras: ResolvedExtras = {
      kind: "char",
      pinyin: String(row.pinyin ?? ""),
      strokeCount: Number(row.stroke_count ?? 0),
    }
    if (row.radical != null) extras.radical = String(row.radical)
    if (row.frequency != null) extras.frequency = Number(row.frequency)
    try {
      const etyRows = await query("hanzipan", SQL.hanziEtymology, [ref.id])
      const byLang = new Map<string, string>()
      for (const r of etyRows) {
        byLang.set(String(r.language_code ?? ""), String(r.summary ?? ""))
      }
      const preferred = [ctx.nativeLang, ctx.targetLang].filter(
        (l): l is string => !!l,
      )
      const picked = pickPreferred(byLang, preferred)
      if (picked) extras.etymology = picked.text
    } catch (err) {
      log("journey_content_char_etymology_error", { char: ref.id, error: String(err) })
    }
    const item: ResolvedItem = {
      ref,
      key: itemRefKey(ref),
      kind: "char",
      target: { text: ref.id, ttsText: ref.id, romanization: extras.pinyin },
      extras,
    }
    return { ok: true, item }
  }

  async function loadSegmentFiles(packId: string): Promise<SegmentFileMaps> {
    const cached = segmentFiles.get(packId)
    if (cached) return cached
    const segText = await deps.fetchPackText(packId, "segments.json")
    const segments = JSON.parse(segText) as SegmentsJson
    let manifest: Record<string, ManifestSegment> | null = null
    try {
      const manText = await deps.fetchPackText(
        packId,
        `audio_manifest_${ctx.targetLang}.json`,
      )
      const parsed = JSON.parse(manText) as { segments?: Record<string, ManifestSegment> }
      manifest = parsed.segments ?? null
    } catch (err) {
      // Audio degrades; text still resolves. The runtime's listen→text
      // degrade owns the render-side consequence.
      log("journey_content_audio_manifest_absent", { packId, error: String(err) })
    }
    const maps: SegmentFileMaps = { segments, manifest }
    segmentFiles.set(packId, maps)
    return maps
  }

  async function resolveSegment(ref: ItemRef): Promise<OneOutcome> {
    const packId = deps.findInstalledNarrationPack(ref.source, ctx.targetLang)
    if (!packId) return miss("pack_not_installed")
    let maps: SegmentFileMaps
    try {
      maps = await loadSegmentFiles(packId)
    } catch {
      return miss("file_absent")
    }
    const segs = maps.segments.segments ?? []
    const seg = segs.find((s) => s.id === ref.id)
    if (!seg) {
      const total = maps.segments.total_segments
      const truncated =
        maps.segments.is_preview === true ||
        (typeof total === "number" && segs.length < total)
      // Never render a paywall surprise inside a feed card (§2.4).
      return miss(truncated ? "preview_truncated" : "row_absent")
    }
    const isHeading = (seg.heading_level ?? 0) === 1 || seg.block_type === "heading"
    const text = seg.text ?? ""
    // heading_level 1 = display-only (never spoken); ttsText falls back to text.
    const ttsText = isHeading ? text : (seg.tts?.text ?? text)
    const extras: ResolvedExtras = {
      kind: "segment",
      bookId: ref.source,
      chapter: Number(seg.chapter ?? 0),
      blockType: isHeading ? "heading" : "text",
    }
    const pause = seg.tts?.pause_after_ms ?? maps.manifest?.[ref.id]?.pause_after_ms
    if (pause != null) extras.pauseAfterMs = pause
    const item: ResolvedItem = {
      ref,
      key: itemRefKey(ref),
      kind: "segment",
      target: { text, ttsText },
      extras,
      // `native` is absent: narration packs are per-language artifacts (§2.4).
    }
    if (!isHeading) {
      const m = maps.manifest?.[ref.id]
      if (m) {
        item.audio = {
          src: deps.packFileUrl(packId, m.file),
          durationMs: m.duration_ms,
          words: m.words?.map((w) => ({
            word: w.word,
            startMs: w.start_ms,
            endMs: w.end_ms,
          })),
        }
      }
    }
    return { ok: true, item }
  }

  async function resolveGrammarNode(
    ref: ItemRef,
    batchExemplars: ResolvedItem[],
  ): Promise<OneOutcome> {
    const rows = await query(ctx.courseId, SQL.grammarNode, [ref.id])
    if (rows.length === 0) return miss("row_absent")
    const row = rows[0]
    const title = (await getString(String(row.title_key ?? ""))) ?? ref.id
    const note = await getString(String(row.note_key ?? ""))
    // The note IS the rule card's body; without it the card is blank (§0.5).
    if (!note) return miss("row_absent")

    let exemplars: ResolvedItem[]
    if (batchExemplars.length > 0) {
      // The mixer's choice: spec.itemRefs listed exemplar phrase refs.
      exemplars = batchExemplars
    } else {
      const exRows = await query(ctx.courseId, SQL.grammarExemplars, [
        String(row.skill_id ?? ""),
      ])
      const refs: ItemRef[] = []
      for (const r of exRows) {
        const kind = String(r.kind ?? "") as ItemRefKind
        const source = String(r.source ?? "")
        const id = String(r.ref_id ?? "")
        if (kind === "phrase" && source && id) refs.push({ kind, source, id })
      }
      const found: ResolvedItem[] = []
      for (const exRef of refs) {
        const one = await resolveOne(exRef, [])
        if (one.ok) found.push(one.item)
      }
      // Seeded pick so the same node always shows the same exemplars (§2.5).
      const rng = mulberry32(fnv1a32(itemRefKey(ref)))
      const shuffled = [...found]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      exemplars = shuffled.slice(0, Math.min(3, shuffled.length))
    }
    // A grammar card without an exemplar is a blank card (§2.5).
    if (exemplars.length === 0) return miss("row_absent")

    const first = exemplars[0]
    const item: ResolvedItem = {
      ref,
      key: itemRefKey(ref),
      kind: "grammarNode",
      // The node is always shown THROUGH an exemplar; its own copy lives in
      // extras (§2.5 — the node has no target-language text of its own).
      target: { text: first.target.text, ttsText: first.target.ttsText },
      level: row.cefr != null ? String(row.cefr) : undefined,
      extras: {
        kind: "grammarNode",
        title,
        note,
        lateAcquired: Number(row.late_acquired ?? 0) === 1,
        exemplars,
      },
    }
    return { ok: true, item }
  }

  async function resolvePhoneme(ref: ItemRef): Promise<OneOutcome> {
    // Phoneme drills are L1-contrastive by construction; no L1 ⇒ no exercise
    // (mixer never issues these on single-language stacks — §2.6).
    if (!ctx.nativeLang) return miss("row_absent")
    const rows = await query(ctx.courseId, SQL.phonemeOverlay, [
      ctx.nativeLang,
      itemRefKey(ref),
    ])
    if (rows.length === 0) return miss("row_absent")
    const payload = JSON.parse(String(rows[0].payload_json ?? "null")) as {
      contrast?: string
      minimalPairs?: [string, string][]
    } | null
    const pairs = payload?.minimalPairs ?? []
    if (!payload || pairs.length === 0) return miss("row_absent")
    const promptWord = pairs[0][0]
    const item: ResolvedItem = {
      ref,
      key: itemRefKey(ref),
      kind: "phoneme",
      target: { text: promptWord, ttsText: promptWord },
      extras: {
        kind: "phoneme",
        contrast: payload.contrast ?? ref.id,
        minimalPairs: pairs,
      },
    }
    return { ok: true, item }
  }

  async function resolveConcept(ref: ItemRef): Promise<OneOutcome> {
    // v0.1: imagepan does not ship (D10.6/D11); this path is exercised only
    // by tests until it lands (§2.7). Image bytes then ride <OfflineImage>.
    if (!deps.findInstalledPack("imagepan")) return miss("pack_not_installed")
    const item: ResolvedItem = {
      ref,
      key: itemRefKey(ref),
      kind: "concept",
      target: { text: ref.id, ttsText: ref.id },
      extras: { kind: "concept" },
    }
    return { ok: true, item }
  }

  async function resolveOne(
    ref: ItemRef,
    batchExemplars: ResolvedItem[],
  ): Promise<OneOutcome> {
    const key = itemRefKey(ref)
    // grammarNode is never served from the item cache: its exemplars depend
    // on the batch composition (§2.5). Its underlying strings/exemplar
    // lookups are cached, so re-resolution stays cheap.
    if (ref.kind !== "grammarNode") {
      const hit = items.get(key)
      if (hit) return { ok: true, item: hit }
    }
    let out: OneOutcome
    try {
      switch (ref.kind) {
        case "phrase":
          out = await resolvePhrase(ref)
          break
        case "word":
          out = await resolveWord(ref)
          break
        case "char":
          out = await resolveChar(ref)
          break
        case "segment":
          out = await resolveSegment(ref)
          break
        case "grammarNode":
          out = await resolveGrammarNode(ref, batchExemplars)
          break
        case "phoneme":
          out = await resolvePhoneme(ref)
          break
        case "concept":
          out = await resolveConcept(ref)
          break
        default:
          out = miss("row_absent")
      }
    } catch (err) {
      // `resolveItems` never throws: db_error wraps and logs (§3.1).
      log("journey_content_db_error", { key, error: String(err) })
      out = miss("db_error")
    }
    if (out.ok && ref.kind !== "grammarNode") items.set(key, out.item)
    // Absence is never cached — a pack may have installed since (§3.2).
    return out
  }

  // -------------------------------------------------------------- surface

  async function resolveItems(refs: ItemRef[]): Promise<ResolveOutcome> {
    const resolved: ResolvedItem[] = []
    const missing: ResolveOutcome["missing"] = []
    const slots: (ResolvedItem | null)[] = new Array(refs.length).fill(null)

    // Pass 1: everything except grammarNode (whose exemplars may come from
    // the batch's phrase refs — §2.5).
    for (let i = 0; i < refs.length; i++) {
      if (refs[i].kind === "grammarNode") continue
      const out = await resolveOne(refs[i], [])
      if (out.ok) slots[i] = out.item
      else {
        missing.push({ ref: refs[i], reason: out.reason })
        log("journey_content_missing", {
          kind: refs[i].kind,
          source: refs[i].source,
          id: refs[i].id,
          reason: out.reason,
        })
      }
    }
    const batchPhrases = slots.filter(
      (s): s is ResolvedItem => s !== null && s.kind === "phrase",
    )
    // Pass 2: grammarNodes, with batch exemplars available.
    for (let i = 0; i < refs.length; i++) {
      if (refs[i].kind !== "grammarNode") continue
      const out = await resolveOne(refs[i], batchPhrases)
      if (out.ok) slots[i] = out.item
      else {
        missing.push({ ref: refs[i], reason: out.reason })
        log("journey_content_missing", {
          kind: refs[i].kind,
          source: refs[i].source,
          id: refs[i].id,
          reason: out.reason,
        })
      }
    }
    for (const s of slots) if (s) resolved.push(s)
    return { resolved, missing }
  }

  async function resolveCharStrokes(char: string): Promise<unknown | null> {
    if (charStrokes.has(char)) return charStrokes.get(char) ?? null
    if (!deps.findInstalledPack("hanzipan")) return null
    try {
      const rows = await query("hanzipan", SQL.hanziStrokes, [char])
      if (rows.length === 0) return null
      const data = JSON.parse(String(rows[0].data_json ?? "null"))
      charStrokes.set(char, data)
      return data
    } catch (err) {
      log("journey_content_strokes_error", { char, error: String(err) })
      return null
    }
  }

  function invalidate(): void {
    items.clear()
    strings.clear()
    stringsByLang.clear()
    segmentFiles.clear()
    charStrokes.clear()
    distractorPools.clear()
  }

  return {
    resolveItems,
    resolveCharStrokes,
    invalidate,
    poolCacheGet: (key) => distractorPools.get(key),
    poolCacheSet: (key, rows) => distractorPools.set(key, rows),
  }
}
