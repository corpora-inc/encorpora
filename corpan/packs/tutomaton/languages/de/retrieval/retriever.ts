/**
 * Retriever for German.
 *
 * Pure on-device pattern-match + sqlite FTS5. Returns one of:
 *   { kind: "theme",       reference: "..." }   → pack short-circuits, no LLM call
 *   { kind: "lesson",      reference: "..." }   → prepended to LLM system prompt
 *   { kind: "lesson_diff", reference: "..." }   → same; "X vs Y" style
 *   { kind: "translation", reference: "..." }   → vocab lookup result
 *   { kind: "l1_error",    reference: "..." }   → L1-aware correction
 *   { kind: null,          reference: null   }  → LLM answers from its own knowledge
 *
 * Dispatch order in `retrieve()`:
 *   1. l1_errors (if user's L1 ≠ target)   ← runs FIRST so we catch mistakes
 *                                              before the literal question
 *   2. vocab patterns (words / idioms / language-specific tables)
 *   3. lang-specific paradigms (verbs, phrasal verbs, etc.)
 *   4. theme patterns
 *   5. direct topic dispatch (regex → lesson)
 *   6. diff patterns (X vs Y → lesson)
 *   7. FTS5 fallback (keyword search over lesson bodies)
 */

export type QueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>

export type RagKind =
  | "theme"
  | "lesson"
  | "lesson_diff"
  | "translation"
  | "l1_error"
  | null

export type RagResult = {
  reference: string | null
  kind: RagKind
  themeKey?: string
  log: string[]
}

// ============================================================
// PATTERNS — customize per language
// ============================================================

const VOCAB_PATTERNS: RegExp[] = [
  /\bhow\s+do\s+you\s+say\s+["'']?(.+?)["'']?\s+in\s+German\b/i,
  /\bwhat['']s?\s+the\s+German\s+(?:word|term)\s+for\s+["'']?(.+?)["'']?[?.]?$/i,
  /\btranslate\s+["'']?(.+?)["'']?(?:\s+to\s+German)?[?.]?$/i,
  /\bwhat\s+does\s+["'']?(.+?)["'']?\s+mean\b/i,
]

const DIFF_PATTERNS: RegExp[] = [
  /\b(.+?)\s+vs\.?\s+(.+?)\b/i,
  /\bdifference\s+between\s+(.+?)\s+and\s+(.+?)\b/i,
]

const THEME_PATTERNS: RegExp[] = [
  /\bshow\s+me\s+(.+?)\s+(?:vocab|vocabulary|words)\b/i,
  /\b(.+?)\s+vocabulary\b/i,
  /\bteach\s+me\s+(.+?)\s+words\b/i,
]

// Theme aliases: map English (and target-language) keywords → theme key
// Customize per language with native-language theme names too.
const THEME_ALIASES: Record<string, string> = {
  food: "food", eat: "food", meal: "food",
  family: "family", relatives: "family",
  body: "body",
  weather: "weather", climate: "weather",
  greeting: "greetings", greetings: "greetings", hello: "greetings",
  number: "numbers", numbers: "numbers",
  color: "colors", colors: "colors", colours: "colors",
  clothes: "clothes", clothing: "clothes",
  transport: "transport", transportation: "transport",
  home: "home", house: "home",
  animal: "animals", animals: "animals",
  kitchen: "kitchen",
  emotion: "emotions", emotions: "emotions", feelings: "emotions",
  restaurant: "restaurant",
  travel: "travel",
  shopping: "shopping",
  school: "school",
  profession: "professions", professions: "professions", jobs: "professions",
  health: "health",
  technology: "technology", tech: "technology",
  sports: "sports", sport: "sports",
  nature: "nature",
  music: "music",
  time: "time_of_day", date: "time_of_day", day: "time_of_day",
  "useful phrases": "useful_phrases",
  // TODO: add native-language theme aliases (e.g. for ZH: 食物 → "food")
}

// Direct topic map: regex → lesson topic slug
// Customize heavily per language — these are the dispatch shortcuts that
// route "teach me X" to the right lesson body.
const DIRECT_TOPIC_MAP: Array<[RegExp, string]> = [
  [/\b(alphabet|letters|sounds)\b/i, "alphabet"],
  [/\b(stress|intonation|rhythm)\b/i, "stress_intonation"],
  [/\b(word\s*order|sentence\s*structure)\b/i, "word_order_basic"],
  [/\b(article|determiner)s?\b/i, "articles"],
  [/\bnoun(s|\s+basics)?\b/i, "nouns_basics"],
  [/\bpronouns?\b/i, "pronouns"],
  [/\bverb(s|\s+basics)?\b/i, "verbs_basics"],
  [/\bpresent\s+(tense|simple)?\b/i, "present_tense"],
  [/\bpast\s+(tense|simple)?\b/i, "past_tense"],
  [/\bfuture\s+(tense|simple)?\b/i, "future_tense"],
  [/\bperfect\s+(aspect|tense)?\b/i, "perfect_aspects"],
  [/\bcontinuous|progressive\b/i, "continuous_aspect"],
  [/\bnegation|negative|how\s+to\s+say\s+not\b/i, "negation"],
  [/\bquestion(s|\s+formation)?\b/i, "questions"],
  [/\bcompar(e|ison|ative|atives)\b/i, "comparison"],
  [/\bconditional|if\s*then\b/i, "conditionals"],
  [/\bmodal\s+verbs?\b/i, "modal_verbs"],
  [/\bpassive\s+voice\b/i, "passive_voice"],
  [/\breported\s+speech|indirect\s+speech\b/i, "reported_speech"],
  [/\brelative\s+clauses?\b/i, "relative_clauses"],
  [/\bsubjunctive\b/i, "subjunctive_or_equivalent"],
  [/\bprepositions?\s+of\s+time\b/i, "prepositions_time"],
  [/\bprepositions?\s+of\s+place\b/i, "prepositions_place"],
  [/\bnumbers?|counting|dates?\b/i, "numbers_basics"],
  [/\bconfusables?|commonly\s+confused\b/i, "confusables_overview"],
  [/\bpolite(ness)?|formal|informal|register\b/i, "politeness_register"],
  [/\b(word\s+formation|prefixes?|suffixes?|compounding)\b/i, "word_formation"],
  [/\bgerund|infinitive\b/i, "gerund_vs_infinitive"],
  [/\badverbs?\b/i, "adverbs"],
  [/\bconjunctions?|connectors?\b/i, "conjunctions"],
  [/\bidioms?\b/i, "common_idioms"],
  [/\bculture|cultural\s+notes?\b/i, "culture_usage_notes"],
]

// ============================================================
// LOOKUP HELPERS
// ============================================================

async function lookupWord(query: string, q: QueryFn): Promise<{ lemma: string; pos: string; ipa: string; glosses_en: string } | null> {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return null
  // Exact match first
  let r = await q("SELECT lemma, pos, ipa, glosses_en FROM words WHERE lemma = ? LIMIT 1", [trimmed])
  if (r.rows.length) {
    const row = r.rows[0] as unknown[]
    return { lemma: row[0] as string, pos: row[1] as string, ipa: row[2] as string, glosses_en: row[3] as string }
  }
  // Gloss search (boundary-first to avoid "cat" matching "category")
  r = await q(
    "SELECT lemma, pos, ipa, glosses_en FROM words " +
      "WHERE glosses_en LIKE ? OR glosses_en LIKE ? OR glosses_en LIKE ? LIMIT 1",
    [`${trimmed}; %`, `%; ${trimmed}; %`, `%; ${trimmed}`],
  )
  if (r.rows.length) {
    const row = r.rows[0] as unknown[]
    return { lemma: row[0] as string, pos: row[1] as string, ipa: row[2] as string, glosses_en: row[3] as string }
  }
  return null
}

function formatWord(w: { lemma: string; pos: string; ipa: string; glosses_en: string }): string {
  const ipa = w.ipa ? ` /${w.ipa}/` : ""
  const pos = w.pos ? ` (${w.pos})` : ""
  return `**${w.lemma}**${ipa}${pos} — ${w.glosses_en}`
}

async function lookupL1Errors(msg: string, l1Code: string, q: QueryFn): Promise<{
  l1_explanation: string
  en_explanation: string
  correct_form: string
  example_wrong: string
  example_right: string
  severity: string
} | null> {
  const r = await q(
    "SELECT error_pattern, correct_form, l1_name, l1_explanation, en_explanation, " +
      "example_wrong, example_right, severity FROM l1_errors WHERE l1_code = ?",
    [l1Code],
  )
  for (const row of r.rows) {
    const pattern = row.error_pattern as string
    let re: RegExp
    try {
      re = new RegExp(pattern, "i")
    } catch {
      continue
    }
    if (re.test(msg)) {
      return {
        correct_form: row[1] as string,
        l1_explanation: (row[3] as string) || "",
        en_explanation: row[4] as string,
        example_wrong: (row[5] as string) || "",
        example_right: (row[6] as string) || "",
        severity: (row[7] as string) || "med",
      }
    }
  }
  return null
}

function formatL1Error(e: {
  l1_explanation: string
  en_explanation: string
  correct_form: string
  example_wrong: string
  example_right: string
  severity: string
}): string {
  const lines = []
  if (e.example_wrong && e.example_right) {
    lines.push(`❌ ${e.example_wrong}`)
    lines.push(`✅ ${e.example_right}`)
    lines.push("")
  }
  if (e.l1_explanation) lines.push(e.l1_explanation)
  if (e.en_explanation) lines.push(e.en_explanation)
  return lines.join("\n")
}

async function lookupLessonByTopic(topic: string, q: QueryFn): Promise<{ topic: string; title: string; body_markdown: string; l1_notes_json: string } | null> {
  const r = await q(
    "SELECT topic, title, body_markdown, l1_notes_json FROM lessons WHERE topic = ?",
    [topic],
  )
  if (!r.rows.length) return null
  const row = r.rows[0] as unknown[]
  return {
    topic: row[0] as string,
    title: row[1] as string,
    body_markdown: row[2] as string,
    l1_notes_json: (row[3] as string) || "",
  }
}

async function lookupLessonFts(query: string, q: QueryFn): Promise<{ title: string; body_markdown: string } | null> {
  const safe = query.replace(/['"]/g, " ").trim()
  if (!safe) return null
  const terms = safe.split(/\s+/).slice(0, 6).join(" OR ")
  try {
    const r = await q(
      "SELECT title, body_markdown FROM lessons_fts WHERE lessons_fts MATCH ? LIMIT 1",
      [terms],
    )
    if (!r.rows.length) return null
    const row = r.rows[0] as unknown[]
    return { title: row[0] as string, body_markdown: row[1] as string }
  } catch {
    return null
  }
}

async function lookupTheme(themeKey: string, q: QueryFn): Promise<Array<{ target_word: string; ipa: string; l1_translations_json: string }>> {
  const r = await q(
    "SELECT target_word, ipa, l1_translations_json FROM vocabulary_themes WHERE theme = ? ORDER BY position",
    [themeKey],
  )
  return r.rows.map((row) => ({
    target_word: row.target_word as string,
    ipa: (row.ipa as string) || "",
    l1_translations_json: (row.l1_translations_json as string) || "",
  }))
}

function formatTheme(items: Array<{ target_word: string; ipa: string; l1_translations_json: string }>, themeKey: string, l1Code: string): string {
  const title = themeKey.replace(/_/g, " ")
  const lines = [`# ${title}`, ""]
  for (const it of items) {
    const ipa = it.ipa ? ` /${it.ipa}/` : ""
    let l1Translation = ""
    try {
      const tr = JSON.parse(it.l1_translations_json || "{}")
      const t = tr[l1Code] || tr.en
      if (t) l1Translation = ` — ${t}`
    } catch { /* ignore */ }
    lines.push(`- **${it.target_word}**${ipa}${l1Translation}`)
  }
  return lines.join("\n")
}

function detectThemeKey(msg: string): string | null {
  // First try THEME_PATTERNS to extract the theme word, then map via aliases
  for (const pat of THEME_PATTERNS) {
    const m = msg.match(pat)
    if (m && m[1]) {
      const word = m[1].trim().toLowerCase()
      if (THEME_ALIASES[word]) return THEME_ALIASES[word]
    }
  }
  // Fallback: substring scan
  const lower = msg.toLowerCase()
  for (const [alias, key] of Object.entries(THEME_ALIASES)) {
    if (lower.includes(alias.toLowerCase())) return key
  }
  return null
}

// ============================================================
// EXPORTS
// ============================================================

/** Direct theme lookup for the pack's theme-bypass code path. */
export async function resolveTheme(themeKey: string, queryDb: QueryFn, l1Code: string = "en"): Promise<string | null> {
  const items = await lookupTheme(themeKey, queryDb)
  if (!items.length) return null
  return formatTheme(items, themeKey, l1Code)
}

export async function retrieve(userMessage: string, queryDb: QueryFn, l1Code: string = "en"): Promise<RagResult> {
  const msg = userMessage.trim()
  const log: string[] = []
  if (!msg) return { reference: null, kind: null, log }

  // 1. L1-error pattern (highest priority — catch mistakes before answering)
  if (l1Code && l1Code !== "de") {
    const err = await lookupL1Errors(msg, l1Code, queryDb)
    if (err) {
      log.push(`l1_error: ${l1Code}`)
      return { reference: formatL1Error(err), kind: "l1_error", log }
    }
  }

  // 2. Vocab lookup
  for (const pat of VOCAB_PATTERNS) {
    const m = msg.match(pat)
    if (m && m[1]) {
      const w = await lookupWord(m[1], queryDb)
      if (w) {
        log.push(`vocab: ${w.lemma}`)
        return { reference: formatWord(w), kind: "translation", log }
      }
    }
  }

  // === LANG-SPECIFIC === (insert verb conjugation / phrasal verb / chengyu lookups here)

  // 3. Theme bypass
  const themeKey = detectThemeKey(msg)
  if (themeKey) {
    const items = await lookupTheme(themeKey, queryDb)
    if (items.length) {
      log.push(`theme: ${themeKey} (${items.length} items)`)
      return { reference: formatTheme(items, themeKey, l1Code), kind: "theme", themeKey, log }
    }
  }

  // 4. Direct topic dispatch
  for (const [pat, topic] of DIRECT_TOPIC_MAP) {
    if (pat.test(msg)) {
      const lesson = await lookupLessonByTopic(topic, queryDb)
      if (lesson) {
        log.push(`lesson: ${topic}`)
        const kind: RagKind = DIFF_PATTERNS.some((p) => p.test(msg)) ? "lesson_diff" : "lesson"
        // Attach L1-specific notes if relevant
        let body = `# ${lesson.title}\n\n${lesson.body_markdown}`
        if (lesson.l1_notes_json && l1Code !== "de") {
          try {
            const notes = JSON.parse(lesson.l1_notes_json)
            if (notes[l1Code]) {
              body += `\n\n## Note for ${l1Code} speakers\n\n${notes[l1Code]}`
            }
          } catch { /* ignore */ }
        }
        return { reference: body, kind, log }
      }
    }
  }

  // 5. FTS fallback
  const fts = await lookupLessonFts(msg, queryDb)
  if (fts) {
    log.push(`lesson_fts`)
    return { reference: `# ${fts.title}\n\n${fts.body_markdown}`, kind: "lesson", log }
  }

  return { reference: null, kind: null, log }
}
