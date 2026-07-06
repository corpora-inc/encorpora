// ============================================================
// Golden fixtures for the Journey content resolver (spec §6).
//
// TEST-ONLY module: imported by *.test.ts files, never by app code.
// Fixture "packs" are real in-memory SQLite databases (node:sqlite —
// built into node ≥ 22.13, no native dep) so the resolver's SQL strings
// actually EXECUTE, plus in-memory JSON for the narration-pack files.
// FixtureDeps implements ResolverDeps over them.
// ============================================================

import { DatabaseSync } from "node:sqlite"
import type { EntryOut } from "../../../contentPacks/types.ts"
import type { PackDbResult, ResolveContext, ResolverDeps } from "../resolve.ts"

export const FIXTURE_CTX: ResolveContext = {
  courseId: "journey_en",
  targetLang: "en",
  nativeLang: "es",
}

export const WORDPACK_ID = "wordpack_es_en"
export const BOOK_ID = "book_fixture_light"
export const NARRATION_PACK_ID = "narr_fixture_light_en"
export const PHRASE_PACK_ID = "phrase-people-basics"
export const CORRUPT_PACK_ID = "corrupt_pack"

// ------------------------------------------------------------ phrase corpus
//
// 20 entries across base + one phrase pack. Deliberate hazards baked in:
//   102 "Good morning"↔"buenas"   — same-translation collision with 101 via es
//   103 "hello"                   — answer-text collision with 101 (case)
//   110 "adios"                   — diacritic-only collision with 109 "adiós"

interface FixtureEntry {
  entry_id: number
  source: string
  level: string
  domains: string[]
  en: string
  es?: string
  esRoman?: string
}

const PHRASE_ENTRIES: FixtureEntry[] = [
  { entry_id: 101, source: "base", level: "A1", domains: ["greetings"], en: "Hello", es: "hola" },
  { entry_id: 102, source: "base", level: "A1", domains: ["greetings"], en: "Good morning", es: "hola" },
  { entry_id: 103, source: "base", level: "A1", domains: ["greetings"], en: "hello", es: "buenas" },
  { entry_id: 104, source: "base", level: "A1", domains: ["greetings"], en: "Good night", es: "buenas noches" },
  { entry_id: 105, source: "base", level: "A1", domains: ["greetings"], en: "How are you?", es: "¿cómo estás?" },
  { entry_id: 106, source: "base", level: "A1", domains: ["greetings"], en: "See you later", es: "hasta luego" },
  { entry_id: 107, source: "base", level: "A1", domains: ["greetings"], en: "Welcome", es: "bienvenido" },
  { entry_id: 108, source: "base", level: "A1", domains: ["greetings"], en: "Thank you", es: "gracias" },
  { entry_id: 109, source: "base", level: "A1", domains: ["greetings"], en: "Goodbye", es: "adiós" },
  { entry_id: 110, source: "base", level: "A1", domains: ["greetings"], en: "Bye", es: "adios" },
  { entry_id: 111, source: "base", level: "A1", domains: ["numbers"], en: "One coffee, please", es: "un café, por favor" },
  { entry_id: 112, source: "base", level: "A1", domains: ["numbers"], en: "Two tickets", es: "dos boletos" },
  { entry_id: 113, source: "base", level: "A1", domains: ["numbers"], en: "Three days", es: "tres días" },
  { entry_id: 114, source: "base", level: "A1", domains: ["numbers"], en: "I have four books", es: "tengo cuatro libros" },
  { entry_id: 115, source: "base", level: "A1", domains: ["numbers"], en: "Five minutes more", es: "cinco minutos más" },
  { entry_id: 116, source: "base", level: "A2", domains: ["time"], en: "She works every day", es: "ella trabaja todos los días" },
  { entry_id: 117, source: "base", level: "A2", domains: ["time"], en: "He eats breakfast early", es: "él desayuna temprano" },
  // Entry with NO english row — exercises translation_absent for target en.
  { entry_id: 118, source: "base", level: "A1", domains: ["greetings"], en: "" },
  { entry_id: 201, source: PHRASE_PACK_ID, level: "A1", domains: ["people"], en: "My friend is here", es: "mi amigo está aquí" },
  { entry_id: 202, source: PHRASE_PACK_ID, level: "A1", domains: ["people"], en: "This is my sister", es: "esta es mi hermana" },
]

function toEntryOut(e: FixtureEntry): EntryOut {
  const translations = []
  if (e.en) translations.push({ language_code: "en", text: e.en, romanization: "" })
  if (e.es) {
    translations.push({ language_code: "es", text: e.es, romanization: e.esRoman ?? "" })
  }
  return {
    entry_id: e.entry_id,
    level: e.level,
    domains: [...e.domains],
    translations,
    source: e.source,
  }
}

// -------------------------------------------------------------- course pack
//
// Mini journey_en slice: 2 units, 3 skills, items across the seven kinds,
// strings in en+es. Only the tables/columns the resolver queries, plus the
// spec'd NOT NULL companions.

const COURSE_PACK_SQL = `
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  intro_order INTEGER NOT NULL UNIQUE,
  difficulty_b REAL NOT NULL
);
CREATE TABLE item_skills (
  item_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  PRIMARY KEY (item_id, skill_id)
);
CREATE TABLE grammar_nodes (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  node_order INTEGER NOT NULL UNIQUE,
  cefr TEXT NOT NULL,
  title_key TEXT NOT NULL,
  note_key TEXT NOT NULL,
  late_acquired INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE l1_overlays (
  l1 TEXT NOT NULL,
  overlay_type TEXT NOT NULL,
  ref_kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  string_key TEXT,
  payload_json TEXT,
  PRIMARY KEY (l1, overlay_type, ref_kind, ref_id)
);
CREATE TABLE strings (
  key TEXT NOT NULL,
  lang TEXT NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (key, lang)
);
`

interface CourseItem {
  id: string
  kind: string
  source: string
  refId: string
  b: number
  skills: string[]
}

const SKILL_GREET = "skill.en.greetings"
const SKILL_NUM = "skill.en.numbers"
const SKILL_PRESENT = "skill.en.present-simple"

function courseItems(): CourseItem[] {
  const out: CourseItem[] = []
  const phraseSkill = (id: number) =>
    id >= 111 && id <= 115 ? SKILL_NUM : id >= 116 ? SKILL_PRESENT : SKILL_GREET
  for (const e of PHRASE_ENTRIES) {
    out.push({
      id: `phrase:${e.source}:${e.entry_id}`,
      kind: "phrase",
      source: e.source,
      refId: String(e.entry_id),
      b: -1 + (e.entry_id % 10) * 0.12,
      skills: [e.source === PHRASE_PACK_ID ? SKILL_GREET : phraseSkill(e.entry_id)],
    })
  }
  out.push(
    { id: "word:en:coffee", kind: "word", source: "en", refId: "coffee", b: -0.6, skills: [SKILL_NUM] },
    // Same-skill (SKILL_NUM) word neighbours WITH es glosses — the gloss
    // distractor pool for coffee's toNative card.
    { id: "word:en:tea", kind: "word", source: "en", refId: "tea", b: -0.55, skills: [SKILL_NUM] },
    { id: "word:en:milk", kind: "word", source: "en", refId: "milk", b: -0.5, skills: [SKILL_NUM] },
    // A gloss TWIN: "cafe" also glosses to "el café" — must be rejected as a
    // coffee distractor (answer-gloss collision under a different key).
    { id: "word:en:cafe", kind: "word", source: "en", refId: "cafe", b: -0.58, skills: [SKILL_NUM] },
    // A word with NO es gloss (wg.friend has only en) — native stays undefined
    // (no en fallback) and it is never a same-language distractor.
    { id: "word:en:friend", kind: "word", source: "en", refId: "friend", b: -0.5, skills: [SKILL_GREET] },
    { id: "char:hanzipan:愛", kind: "char", source: "hanzipan", refId: "愛", b: 0.4, skills: [SKILL_GREET] },
    { id: `segment:${BOOK_ID}:ch01-002`, kind: "segment", source: BOOK_ID, refId: "ch01-002", b: 0.1, skills: [SKILL_PRESENT] },
    { id: "grammarNode:journey_en:en.gn.present-simple-3sg", kind: "grammarNode", source: "journey_en", refId: "en.gn.present-simple-3sg", b: 0.2, skills: [SKILL_PRESENT] },
    { id: "phoneme:journey_en:iː-ɪ", kind: "phoneme", source: "journey_en", refId: "iː-ɪ", b: 0.0, skills: [SKILL_GREET] },
    { id: "concept:imagepan:obj_bicycle", kind: "concept", source: "imagepan", refId: "obj_bicycle", b: -0.8, skills: [SKILL_GREET] },
  )
  return out
}

function buildCoursePackDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:")
  db.exec(COURSE_PACK_SQL)
  const insItem = db.prepare(
    "INSERT INTO items (id, kind, source, ref_id, intro_order, difficulty_b) VALUES (?,?,?,?,?,?)",
  )
  const insSkill = db.prepare("INSERT INTO item_skills (item_id, skill_id) VALUES (?,?)")
  let order = 1
  for (const it of courseItems()) {
    insItem.run(it.id, it.kind, it.source, it.refId, order++, it.b)
    for (const s of it.skills) insSkill.run(it.id, s)
  }
  db.prepare(
    "INSERT INTO grammar_nodes (id, skill_id, node_order, cefr, title_key, note_key, late_acquired) VALUES (?,?,?,?,?,?,?)",
  ).run(
    "en.gn.present-simple-3sg",
    SKILL_PRESENT,
    1,
    "A2",
    "gn.en.gn.present-simple-3sg.title",
    "gn.en.gn.present-simple-3sg.note",
    1,
  )
  // A node whose note string is missing — exercises the row_absent gate.
  db.prepare(
    "INSERT INTO grammar_nodes (id, skill_id, node_order, cefr, title_key, note_key, late_acquired) VALUES (?,?,?,?,?,?,?)",
  ).run("en.gn.noteless", SKILL_GREET, 2, "A1", "gn.en.gn.noteless.title", "gn.en.gn.noteless.note", 0)
  // A node on the 12-phrase greetings skill: its exemplar query (LIMIT 8)
  // returns a FULL page — exercises the R7 truncation warning.
  db.prepare(
    "INSERT INTO grammar_nodes (id, skill_id, node_order, cefr, title_key, note_key, late_acquired) VALUES (?,?,?,?,?,?,?)",
  ).run("en.gn.greetings", SKILL_GREET, 3, "A1", "gn.en.gn.greetings.title", "gn.en.gn.greetings.note", 0)
  db.prepare(
    "INSERT INTO l1_overlays (l1, overlay_type, ref_kind, ref_id, string_key, payload_json) VALUES (?,?,?,?,?,?)",
  ).run(
    "es",
    "phoneme_pair",
    "item",
    "phoneme:journey_en:iː-ɪ",
    null,
    JSON.stringify({ contrast: "iː-ɪ", minimalPairs: [["ship", "sheep"], ["sit", "seat"], ["chip", "cheap"]] }),
  )
  // es contrastive_note on the present-simple node — the grammar-depth overlay
  // rendered inside the grammar card for an ES learner.
  db.prepare(
    "INSERT INTO l1_overlays (l1, overlay_type, ref_kind, ref_id, string_key, payload_json) VALUES (?,?,?,?,?,?)",
  ).run(
    "es",
    "contrastive_note",
    "grammarNode",
    "en.gn.present-simple-3sg",
    "ovl.es.present-3sg.note",
    null,
  )
  const insStr = db.prepare("INSERT INTO strings (key, lang, text) VALUES (?,?,?)")
  insStr.run("gn.en.gn.present-simple-3sg.title", "en", "Third-person -s")
  insStr.run("gn.en.gn.present-simple-3sg.title", "es", "La -s de tercera persona")
  insStr.run(
    "gn.en.gn.present-simple-3sg.note",
    "en",
    "With he, she, or it, the present-simple verb takes an -s: she works, he eats.",
  )
  insStr.run(
    "gn.en.gn.present-simple-3sg.note",
    "es",
    "Con he, she o it, el verbo en presente simple lleva -s: she works, he eats.",
  )
  // Contrastive-note copy is authored per L1 (es here). Native-only: no en row,
  // proving getStringForLang selects the learner's language, not a fallback.
  insStr.run(
    "ovl.es.present-3sg.note",
    "es",
    "En español el verbo ya marca la persona, así que la -s inglesa se olvida fácil: recuerda \"she works\", no \"she work\".",
  )
  insStr.run("gn.en.gn.noteless.title", "en", "Noteless node")
  insStr.run("gn.en.gn.greetings.title", "en", "Greetings")
  insStr.run("gn.en.gn.greetings.title", "es", "Saludos")
  insStr.run("gn.en.gn.greetings.note", "en", "Greetings open a conversation: hello, good morning, welcome.")
  insStr.run("gn.en.gn.greetings.note", "es", "Los saludos abren una conversación: hello, good morning, welcome.")
  // Word glosses (wg.<word>): the native FACE of word cards (contract #1). en
  // is the disambiguating gloss (or the word itself); es is the learner face.
  // `friend` carries ONLY en — exercising the native-only lookup's no-fallback
  // rule (native must stay undefined, never "friend").
  const insGloss = (word: string, en: string, es?: string) => {
    insStr.run(`wg.${word}`, "en", en)
    if (es) insStr.run(`wg.${word}`, "es", es)
  }
  insGloss("coffee", "coffee", "el café")
  insGloss("tea", "tea", "el té")
  insGloss("milk", "milk", "la leche")
  insGloss("cafe", "cafe", "el café")
  insGloss("friend", "friend") // en only — no es face
  return db
}

// ------------------------------------------------------------------ wordpan

function buildWordpanDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:")
  db.exec(
    "CREATE TABLE word_explanation (word TEXT NOT NULL, language_code TEXT NOT NULL, paragraph TEXT NOT NULL, PRIMARY KEY (word, language_code))",
  )
  const ins = db.prepare(
    "INSERT INTO word_explanation (word, language_code, paragraph) VALUES (?,?,?)",
  )
  const words: Array<[string, string, string]> = [
    ["coffee", "es", "Coffee es la bebida hecha de granos tostados; también la reunión informal para tomarla."],
    ["coffee", "en", "Coffee is the drink brewed from roasted beans; informally, a short social meeting over a cup."],
    ["friend", "es", "Friend es una persona con la que tienes un vínculo de afecto y confianza."],
    ["friend", "en", "A friend is a person you share affection and trust with."],
    ["book", "es", "Book es un conjunto de páginas; como verbo, reservar."],
    ["book", "en", "A book is a set of printed pages; as a verb, to reserve."],
    ["light", "es", "Light es la luz visible; como adjetivo, ligero o claro."],
    ["light", "en", "Light is visible energy; as an adjective, not heavy, or pale."],
    ["work", "es", "Work es el trabajo o funcionar correctamente."],
    ["work", "en", "Work is effort or a job; machines that work are functioning."],
  ]
  for (const [w, l, p] of words) ins.run(w, l, p)
  return db
}

// ----------------------------------------------------------------- hanzipan

function buildHanzipanDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:")
  db.exec(`
    CREATE TABLE hanzi_character (char TEXT PRIMARY KEY, pinyin TEXT NOT NULL,
      stroke_count INTEGER NOT NULL, radical TEXT, frequency INTEGER);
    CREATE TABLE hanzi_etymology (char TEXT NOT NULL, language_code TEXT NOT NULL,
      summary TEXT NOT NULL, PRIMARY KEY (char, language_code));
    CREATE TABLE hanzi_writer (char TEXT PRIMARY KEY, data_json TEXT NOT NULL);
  `)
  const chars: Array<[string, string, number, string | null, number | null]> = [
    ["愛", "ài", 13, "心", 394],
    ["水", "shuǐ", 4, "水", 201],
    ["火", "huǒ", 4, "火", 434],
    ["山", "shān", 3, "山", 259],
    ["木", "mù", 4, "木", 694],
  ]
  const insChar = db.prepare(
    "INSERT INTO hanzi_character (char, pinyin, stroke_count, radical, frequency) VALUES (?,?,?,?,?)",
  )
  const insEty = db.prepare(
    "INSERT INTO hanzi_etymology (char, language_code, summary) VALUES (?,?,?)",
  )
  for (const [c, p, s, r, f] of chars) {
    insChar.run(c, p, s, r, f)
    insEty.run(c, "en", `Etymology of ${c} in English.`)
    insEty.run(c, "es", `Etimología de ${c} en español.`)
  }
  db.prepare("INSERT INTO hanzi_writer (char, data_json) VALUES (?,?)").run(
    "愛",
    JSON.stringify({ strokes: ["M 1 1", "M 2 2"], medians: [[[1, 1]], [[2, 2]]] }),
  )
  return db
}

// ------------------------------------------------------------ narration pack

export function narrationSegmentsJson(opts?: { preview?: boolean }): string {
  const segments = [
    { id: "ch01-001", chapter: 1, heading_level: 1, text: "Light", tts: { text: "", pause_after_ms: 0 } },
    { id: "ch01-002", chapter: 1, text: "Light is energy you can see.", tts: { text: "Light is energy you can see.", pause_after_ms: 2000 } },
    { id: "ch01-003", chapter: 1, text: "It travels in waves at 300,000 km per second.", tts: { text: "It travels in waves at three hundred thousand kilometers per second.", pause_after_ms: 900 } },
    { id: "ch01-004", chapter: 1, text: "The sun sends light across space.", tts: { text: "The sun sends light across space.", pause_after_ms: 900 } },
    { id: "ch02-001", chapter: 2, text: "Shadows form when light is blocked.", tts: { text: "Shadows form when light is blocked.", pause_after_ms: 900 } },
    { id: "ch02-002", chapter: 2, text: "Mirrors bounce light back.", tts: { text: "Mirrors bounce light back.", pause_after_ms: 900 } },
  ]
  const kept = opts?.preview ? segments.slice(0, 3) : segments
  return JSON.stringify({
    total_segments: segments.length,
    ...(opts?.preview ? { is_preview: true } : {}),
    segments: kept,
  })
}

export function narrationManifestJson(): string {
  const seg = (id: string, dur: number, words: Array<[string, number, number]>) => [
    id,
    {
      file: `audio/en/${id}.m4a`,
      duration_ms: dur,
      pause_after_ms: 2000,
      words: words.map(([word, start_ms, end_ms]) => ({ word, start_ms, end_ms })),
    },
  ]
  return JSON.stringify({
    language: "en",
    voice: "fixture",
    sample_rate: 24000,
    segments: Object.fromEntries([
      seg("ch01-002", 2440, [
        ["Light", 40, 420],
        ["is", 480, 820],
        ["energy", 820, 1180],
        ["you", 1180, 1440],
        ["can", 1440, 1760],
        ["see.", 1760, 1920],
      ]),
      seg("ch01-003", 3100, [["It", 30, 200]]),
      seg("ch01-004", 2100, [["The", 30, 180]]),
      seg("ch02-001", 2300, [["Shadows", 30, 400]]),
      seg("ch02-002", 1900, [["Mirrors", 30, 420]]),
    ]),
  })
}

// -------------------------------------------------------------- FixtureDeps

export interface FixtureEvent {
  event: string
  data: Record<string, unknown>
}

export interface FixtureOptions {
  /** Installed pack ids beyond the defaults. Defaults: course pack,
   *  phrase pack, hanzipan, narration pack, wordpan pair. */
  installed?: Set<string>
  wordPackInstalled?: boolean
  narrationInstalled?: boolean
  narrationPreview?: boolean
  hanzipanInstalled?: boolean
  imagepanInstalled?: boolean
  /** Random entries served by rung-3 top-up. */
  randomEntries?: EntryOut[]
}

export class FixtureDeps implements ResolverDeps {
  readonly events: FixtureEvent[] = []
  readonly coursePack = buildCoursePackDb()
  readonly wordpan = buildWordpanDb()
  readonly hanzipan = buildHanzipanDb()
  private opts: FixtureOptions
  /** Test hook: force queryPackDb to throw for a packId (db_error path). */
  corruptPacks = new Set<string>([CORRUPT_PACK_ID])
  /** Test hook: count queries per packId (cache assertions). */
  readonly queryCounts = new Map<string, number>()

  constructor(opts: FixtureOptions = {}) {
    this.opts = {
      wordPackInstalled: true,
      narrationInstalled: true,
      hanzipanInstalled: true,
      imagepanInstalled: false,
      ...opts,
    }
  }

  setWordPackInstalled(on: boolean): void {
    this.opts.wordPackInstalled = on
  }

  setHanzipanInstalled(on: boolean): void {
    this.opts.hanzipanInstalled = on
  }

  /** Test hook: getEntryById call count (item-cache assertions). */
  entryCalls = 0

  log = (event: string, data: Record<string, unknown>): void => {
    this.events.push({ event, data })
  }

  async getEntryById(entryId: number, source: string): Promise<EntryOut | null> {
    this.entryCalls++
    const e = PHRASE_ENTRIES.find((x) => x.entry_id === entryId && x.source === source)
    return e ? toEntryOut(e) : null
  }

  async getRandomEntries(q: {
    count: number
    domains?: string[]
    levels?: string[]
  }): Promise<EntryOut[]> {
    const pool = this.opts.randomEntries ?? []
    return pool.slice(0, q.count)
  }

  private dbFor(packId: string): DatabaseSync | null {
    if (packId === FIXTURE_CTX.courseId) return this.coursePack
    if (packId === WORDPACK_ID) return this.wordpan
    if (packId === "hanzipan") return this.hanzipan
    return null
  }

  async queryPackDb(q: {
    packId: string
    dbName?: string
    sql: string
    params?: unknown[]
    maxRows?: number
  }): Promise<PackDbResult> {
    this.queryCounts.set(q.packId, (this.queryCounts.get(q.packId) ?? 0) + 1)
    if (this.corruptPacks.has(q.packId)) {
      throw new Error(`fixture: corrupted database for ${q.packId}`)
    }
    const db = this.dbFor(q.packId)
    if (!db) throw new Error(`fixture: no database for pack ${q.packId}`)
    const stmt = db.prepare(q.sql)
    const all = stmt.all(...((q.params ?? []) as never[])) as Record<string, unknown>[]
    // Mirror the Rust layer: cap at maxRows (default 500), truncate SILENTLY.
    const cap = Math.min(q.maxRows ?? 500, 2000)
    const rows = all.slice(0, cap).map((r) => ({ ...r }))
    return { columns: rows.length ? Object.keys(rows[0]) : [], rows }
  }

  async fetchPackText(packId: string, relPath: string): Promise<string> {
    if (packId === NARRATION_PACK_ID) {
      if (relPath === "segments.json") {
        return narrationSegmentsJson({ preview: this.opts.narrationPreview })
      }
      if (relPath === "audio_manifest_en.json") return narrationManifestJson()
    }
    throw new Error(`fixture: no file ${packId}/${relPath}`)
  }

  packFileUrl(packId: string, relPath: string): string {
    return `corpan-pack://localhost/${packId}/${relPath}`
  }

  findInstalledWordPack(nativeLang: string, targetLang: string): string | null {
    if (!this.opts.wordPackInstalled) return null
    return nativeLang === "es" && targetLang === "en" ? WORDPACK_ID : null
  }

  findInstalledNarrationPack(bookId: string, lang: string): string | null {
    if (!this.opts.narrationInstalled) return null
    return bookId === BOOK_ID && lang === "en" ? NARRATION_PACK_ID : null
  }

  findInstalledPack(packId: string): boolean {
    if (packId === "hanzipan") return this.opts.hanzipanInstalled !== false
    if (packId === "imagepan") return this.opts.imagepanInstalled === true
    if (packId === PHRASE_PACK_ID) return true
    if (packId === FIXTURE_CTX.courseId) return true
    return this.opts.installed?.has(packId) ?? false
  }
}

/** Random-entry pool for rung-3 tests (not course items). */
export function topUpEntries(): EntryOut[] {
  return [
    {
      entry_id: 901,
      level: "A1",
      domains: ["misc"],
      translations: [
        { language_code: "en", text: "The cat sleeps", romanization: "" },
        { language_code: "es", text: "el gato duerme", romanization: "" },
      ],
      source: "base",
    },
    {
      entry_id: 902,
      level: "A1",
      domains: ["misc"],
      translations: [
        { language_code: "en", text: "A red door", romanization: "" },
        { language_code: "es", text: "una puerta roja", romanization: "" },
      ],
      source: "base",
    },
    {
      entry_id: 903,
      level: "A1",
      domains: ["misc"],
      translations: [
        { language_code: "en", text: "We walk home", romanization: "" },
        { language_code: "es", text: "caminamos a casa", romanization: "" },
      ],
      source: "base",
    },
  ]
}
