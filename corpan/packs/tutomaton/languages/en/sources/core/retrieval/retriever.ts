/**
 * English retriever for Tutomaton.
 *
 * Dispatch order:
 *   1. L1-aware error patterns (catch typical L1 mistakes BEFORE answering)
 *   2. Phrasal-verb lookup ("what does 'put up with' mean")
 *   3. Theme bypass (food / family / body vocab → canonical list)
 *   4. Direct lesson topic dispatch
 *   5. FTS5 fallback over lesson bodies
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
  | "phrasal_verb"
  | null

export type RagResult = {
  reference: string | null
  kind: RagKind
  themeKey?: string
  log: string[]
}

const THEME_ALIASES: Record<string, string> = {
  food: "food", eat: "food", meal: "food", meals: "food", eating: "food",
  drink: "drinks", drinks: "drinks", beverage: "drinks", beverages: "drinks", drinking: "drinks",
  family: "family", relatives: "family",
  body: "body", "body parts": "body",
}

const THEME_PATTERNS: RegExp[] = [
  /\bshow\s+me\s+(.+?)\s+(?:vocab(?:ulary)?|words|terms)\b/i,
  /\b(.+?)\s+vocabulary\b/i,
  /\bteach\s+me\s+(.+?)\s+words?\b/i,
  /\bwhat\s+are\s+(?:some|the)\s+(.+?)\s+(?:words|terms|vocab)\b/i,
  /\blist\s+(?:some|the)\s+(.+?)\s+(?:words|vocab)\b/i,
]

const DIRECT_TOPIC_MAP: Array<[RegExp, string]> = [
  [/\b(?:articles?|a\s+vs\s+an|when\s+to\s+use\s+(?:a|an|the))\b/i, "articles_a_an_the"],
  [/\b(?:countable|uncountable|mass\s+noun|much\s+vs\s+many|fewer\s+vs\s+less)\b/i, "countable_uncountable"],
  [/\b(?:plurals?|irregular\s+plurals)\b/i, "plurals"],
  [/\b(?:tense\s+overview|english\s+tenses|all\s+tenses)\b/i, "tense_overview"],
  [/\b(?:present\s+simple|simple\s+present)\b/i, "present_simple"],
  [/\b(?:present\s+continuous|present\s+progressive)\b/i, "present_continuous"],
  [/\b(?:present\s+perfect\s+continuous)\b/i, "present_perfect_continuous"],
  [/\b(?:present\s+perfect)\b/i, "present_perfect"],
  [/\b(?:past\s+simple|simple\s+past)\b/i, "past_simple"],
  [/\b(?:past\s+continuous|past\s+progressive)\b/i, "past_continuous"],
  [/\b(?:past\s+perfect)\b/i, "past_perfect"],
  [/\b(?:future\s+continuous)\b/i, "future_continuous"],
  [/\b(?:future\s+perfect)\b/i, "future_perfect"],
  [/\b(?:future|will\s+vs\s+going\s+to|going\s+to)\b/i, "future_will_going_to"],
  [/\b(?:can\s+vs\s+could|modals?\s+of\s+ability|be\s+able\s+to)\b/i, "modals_ability"],
  [/\b(?:must\s+vs\s+should|should\s+vs\s+must|modals?\s+of\s+obligation|have\s+to|must|should|ought\s+to)\b/i, "modals_deontic"],
  [/\b(?:modals?\s+of\s+deduction|might|may|can'?t\s+vs\s+mustn'?t)\b/i, "modals_epistemic"],
  [/\b(?:zero\s+conditional|first\s+conditional|conditionals)\b/i, "conditionals_zero_first"],
  [/\b(?:second\s+conditional|third\s+conditional|unreal\s+conditional|hypothetical)\b/i, "conditionals_second_third"],
  [/\b(?:passive\s+voice|passive)\b/i, "passive_voice"],
  [/\b(?:reported\s+speech|indirect\s+speech)\b/i, "reported_speech"],
  [/\b(?:relative\s+clauses?|who\s+vs\s+which|that\s+vs\s+which)\b/i, "relative_clauses"],
  [/\b(?:gerund\s+vs\s+infinitive|gerunds?|infinitives?)\b/i, "gerund_vs_infinitive"],
  [/\b(?:do\s*-?\s*support|questions?\s+with\s+do|how\s+to\s+(?:make|form|ask)\s+questions?)\b/i, "questions_do_support"],
  [/\b(?:word\s+order|sentence\s+structure|adjective\s+order)\b/i, "word_order"],
  [/\b(?:negation|negatives?|how\s+to\s+say\s+no(?:t)?)\b/i, "negation"],
  [/\b(?:phrasal\s+verbs?\s+overview|what\s+are\s+phrasal\s+verbs?)\b/i, "phrasal_verbs_overview"],
  [/\b(?:prepositions?\s+of\s+time|in\s+vs\s+on\s+vs\s+at\s+time)\b/i, "prepositions_time"],
  [/\b(?:prepositions?\s+of\s+place|in\s+vs\s+on\s+vs\s+at\s+place)\b/i, "prepositions_place"],
  [/\b(?:comparison|comparatives?|superlatives?|-er\s+vs\s+more)\b/i, "comparison"],
  [/\b(?:do\s+vs\s+make|make\s+vs\s+do)\b/i, "confusables_do_make"],
  [/\b(?:say\s+vs\s+tell|tell\s+vs\s+say)\b/i, "confusables_say_tell"],
  [/\b(?:confusables?|commonly\s+confused|its\s+vs\s+it'?s|fewer\s+vs\s+less|affect\s+vs\s+effect|lie\s+vs\s+lay|bring\s+vs\s+take|borrow\s+vs\s+lend|then\s+vs\s+than)\b/i, "confusables_overview"],
  [/\b(?:silent\s+letters?)\b/i, "silent_letters"],
  [/\b(?:stress|intonation|word\s+stress|rhythm)\b/i, "stress_intonation"],
  [/\b(?:greetings?|hello|how\s+to\s+greet|formal\s+vs\s+informal\s+greeting)\b/i, "greetings_register"],
  [/\b(?:numbers?|dates?|telling\s+time|how\s+to\s+say\s+the\s+time)\b/i, "numbers_dates_times"],
  [/\b(?:politeness|register|formal\s+vs\s+informal)\b/i, "politeness_register"],
  [/\b(?:idioms?|common\s+expressions?)\b/i, "common_idioms"],
  [/\b(?:culture|cultural\s+notes?|small\s+talk|usage)\b/i, "culture_usage_notes"],
]

const DIFF_PATTERNS: RegExp[] = [
  /\bdifference\s+between\b/i,
  /\bvs\.?\b/i,
  /\bcompared\s+to\b/i,
]

type L1ErrorRow = {
  l1_explanation: string
  en_explanation: string
  correct_form: string
  example_wrong: string
  example_right: string
  severity: string
  lesson_topic: string | null
}

async function lookupL1Error(msg: string, l1Code: string, q: QueryFn): Promise<L1ErrorRow | null> {
  const r = await q(
    "SELECT error_pattern, correct_form, l1_explanation, en_explanation, " +
      "example_wrong, example_right, severity, lesson_topic FROM l1_errors WHERE l1_code = ?",
    [l1Code],
  )
  for (const row of r.rows) {
    const pattern = row.error_pattern as string
    let re: RegExp
    try { re = new RegExp(pattern, "i") } catch { continue }
    if (re.test(msg)) {
      return {
        correct_form: row.correct_form as string,
        l1_explanation: (row.l1_explanation as string) || "",
        en_explanation: row.en_explanation as string,
        example_wrong: (row.example_wrong as string) || "",
        example_right: (row.example_right as string) || "",
        severity: (row.severity as string) || "med",
        lesson_topic: (row.lesson_topic as string) || null,
      }
    }
  }
  return null
}

function formatL1Error(e: L1ErrorRow): string {
  const lines: string[] = []
  if (e.example_wrong && e.example_right) {
    lines.push(`❌ ${e.example_wrong}`)
    lines.push(`✅ ${e.example_right}`)
    lines.push("")
  }
  if (e.l1_explanation) lines.push(e.l1_explanation)
  if (e.en_explanation && e.en_explanation !== e.l1_explanation) {
    if (e.l1_explanation) lines.push("")
    lines.push(e.en_explanation)
  }
  return lines.join("\n")
}

type PhrasalMatch = { verb: string; particle: string; meaning: string; example_en: string; separability: string }

async function lookupPhrasalVerb(text: string, q: QueryFn): Promise<PhrasalMatch[]> {
  const lower = text.toLowerCase()
  const r = await q("SELECT verb, particle, meaning, example_en, separability FROM phrasal_verbs")
  const matches: PhrasalMatch[] = []
  for (const row of r.rows) {
    const v = (row.verb as string).toLowerCase()
    const p = (row.particle as string).toLowerCase()
    const phrase = `${v} ${p}`
    if (lower.includes(phrase)) {
      matches.push({
        verb: row.verb as string,
        particle: row.particle as string,
        meaning: row.meaning as string,
        example_en: (row.example_en as string) || "",
        separability: (row.separability as string) || "",
      })
    }
  }
  return matches
}

function formatPhrasalVerbs(matches: PhrasalMatch[]): string {
  if (matches.length === 1) {
    const m = matches[0]
    return `**${m.verb} ${m.particle}** — ${m.meaning}\n\n_Example_: ${m.example_en}\n\n(${m.separability})`
  }
  const lines = [`# ${matches[0].verb} ${matches[0].particle}`, ""]
  for (const m of matches) {
    lines.push(`- **${m.meaning}** — ${m.example_en}`)
  }
  return lines.join("\n")
}

async function lookupLessonByTopic(topic: string, q: QueryFn): Promise<{
  topic: string; title: string; body_markdown: string; l1_notes_json: string
} | null> {
  const r = await q(
    "SELECT topic, title, body_markdown, l1_notes_json FROM lessons WHERE topic = ?",
    [topic],
  )
  if (!r.rows.length) return null
  const row = r.rows[0]
  return {
    topic: row.topic as string,
    title: row.title as string,
    body_markdown: row.body_markdown as string,
    l1_notes_json: (row.l1_notes_json as string) || "",
  }
}

async function lookupLessonFts(query: string, q: QueryFn): Promise<{
  topic: string; title: string; body_markdown: string
} | null> {
  const safe = query.replace(/['"]/g, " ").trim()
  if (!safe) return null
  try {
    const terms = safe.split(/\s+/).slice(0, 6).join(" OR ")
    const r = await q(
      "SELECT topic, title, body_markdown FROM lessons_fts WHERE lessons_fts MATCH ? LIMIT 1",
      [terms],
    )
    if (!r.rows.length) return null
    const row = r.rows[0]
    return {
      topic: row.topic as string,
      title: row.title as string,
      body_markdown: row.body_markdown as string,
    }
  } catch {
    return null
  }
}

async function lookupTheme(themeKey: string, q: QueryFn): Promise<Array<{
  target_word: string; ipa: string; l1_translations_json: string
}>> {
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
    let translation = ""
    try {
      const tr = JSON.parse(it.l1_translations_json || "{}") as Record<string, string>
      const t = tr[l1Code] || tr.en
      if (t && l1Code !== "en") translation = ` — ${t}`
    } catch { /* ignore */ }
    lines.push(`- **${it.target_word}**${ipa}${translation}`)
  }
  return lines.join("\n")
}

function detectThemeKey(msg: string): string | null {
  for (const pat of THEME_PATTERNS) {
    const m = msg.match(pat)
    if (m && m[1]) {
      const word = m[1].trim().toLowerCase()
      if (THEME_ALIASES[word]) return THEME_ALIASES[word]
    }
  }
  const lower = msg.toLowerCase()
  for (const [alias, key] of Object.entries(THEME_ALIASES)) {
    if (lower.includes(alias)) return key
  }
  return null
}

export async function resolveTheme(themeKey: string, queryDb: QueryFn, l1Code: string = "en"): Promise<string | null> {
  const items = await lookupTheme(themeKey, queryDb)
  if (!items.length) return null
  return formatTheme(items, themeKey, l1Code)
}

export async function retrieve(userMessage: string, queryDb: QueryFn, l1Code: string = "en"): Promise<RagResult> {
  const msg = userMessage.trim()
  const log: string[] = []
  if (!msg) return { reference: null, kind: null, log }

  // 1. L1-error (highest priority)
  if (l1Code && l1Code !== "en") {
    const err = await lookupL1Error(msg, l1Code, queryDb)
    if (err) {
      log.push(`l1_error: ${l1Code}`)
      return { reference: formatL1Error(err), kind: "l1_error", log }
    }
  }

  // 2. Phrasal verb
  const phrasals = await lookupPhrasalVerb(msg, queryDb)
  if (phrasals.length) {
    log.push(`phrasal_verb: ${phrasals[0].verb} ${phrasals[0].particle} (${phrasals.length})`)
    return { reference: formatPhrasalVerbs(phrasals), kind: "phrasal_verb", log }
  }

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
        let body = `# ${lesson.title}\n\n${lesson.body_markdown}`
        if (lesson.l1_notes_json && l1Code !== "en") {
          try {
            const notes = JSON.parse(lesson.l1_notes_json) as Record<string, string>
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
    log.push(`lesson_fts: ${fts.topic}`)
    return { reference: `# ${fts.title}\n\n${fts.body_markdown}`, kind: "lesson", log }
  }

  return { reference: null, kind: null, log }
}
