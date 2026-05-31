/**
 * Mandarin retriever — minimal seed.
 *
 * The Spanish retriever (../../es/retrieval/retriever.ts) is the full reference;
 * the Mandarin version starts much smaller and grows. Mandarin lacks inflection
 * so the conjugation paths are dropped entirely; the load-bearing paths are:
 *
 *   1. Direct theme lookup ("show me food vocab", "饮料")
 *   2. Lesson lookup by topic ("tones", "把构造")
 *   3. Lesson FTS ("how do I use 了", "what's the difference between 不 and 没")
 *
 * Polish-machine TODO: port the Spanish patterns more thoroughly + add
 * native-Chinese query patterns (用中文怎么说, etc.).
 */

export type QueryFn = (sql: string, params: unknown[]) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>

export type RagKind = "theme" | "lesson" | "lesson_diff" | "translation" | null

export type RagResult = {
  reference: string | null
  kind: RagKind
  themeKey?: string
  log: string[]
}

// ============================================================
// Theme dispatch — English + native Chinese keywords → theme key
// ============================================================

const THEME_ALIASES: Record<string, string> = {
  // english
  food: "food", eat: "food", meal: "food", "食物": "food",
  drink: "drinks", beverage: "drinks", "饮料": "drinks", "喝的": "drinks",
  family: "family", relatives: "family", "家人": "family", "家庭": "family",
  body: "body", "身体": "body", "身体部位": "body",
  weather: "weather", climate: "weather", "天气": "weather",
  greeting: "greetings", greetings: "greetings", hello: "greetings", "问候": "greetings", "打招呼": "greetings",
  number: "numbers", numbers: "numbers", "数字": "numbers",
  color: "colors", colors: "colors", colours: "colors", "颜色": "colors",
  clothes: "clothes", clothing: "clothes", "衣服": "clothes",
  transport: "transportation", transportation: "transportation", "交通": "transportation",
}

const THEME_TITLES: Record<string, string> = {
  food: "食物 (food)",
  drinks: "饮料 (drinks)",
  family: "家人 (family)",
  body: "身体 (body)",
  weather: "天气 (weather)",
  greetings: "问候 (greetings)",
  numbers: "数字 (numbers)",
  colors: "颜色 (colors)",
  clothes: "衣服 (clothes)",
  transportation: "交通 (transportation)",
}

function detectThemeKey(msg: string): string | null {
  const lower = msg.toLowerCase()
  for (const [alias, key] of Object.entries(THEME_ALIASES)) {
    if (lower.includes(alias.toLowerCase()) || msg.includes(alias)) return key
  }
  return null
}

async function lookupTheme(themeKey: string, q: QueryFn): Promise<Array<{ hanzi: string; pinyin: string; english: string; classifier: string | null }>> {
  const r = await q(
    "SELECT hanzi, pinyin, english, classifier FROM vocabulary_themes WHERE theme = ? ORDER BY position",
    [themeKey]
  )
  return r.rows.map((row) => ({
    hanzi: row.hanzi as string,
    pinyin: row.pinyin as string,
    english: row.english as string,
    classifier: (row.classifier as string | null) ?? null,
  }))
}

function formatTheme(items: Array<{ hanzi: string; pinyin: string; english: string; classifier: string | null }>, themeKey: string): string {
  const title = THEME_TITLES[themeKey] ?? themeKey
  const lines = [`# ${title}`, ""]
  for (const it of items) {
    const cl = it.classifier ? ` [量: ${it.classifier}]` : ""
    lines.push(`- **${it.hanzi}** (${it.pinyin}) — ${it.english}${cl}`)
  }
  return lines.join("\n")
}

// ============================================================
// Lesson lookup
// ============================================================

async function lookupLessonByTopic(topic: string, q: QueryFn): Promise<{ topic: string; title: string; body_markdown: string } | null> {
  const r = await q("SELECT topic, title, body_markdown FROM lessons WHERE topic = ?", [topic])
  if (!r.rows.length) return null
  const row = r.rows[0]
  return { topic: row.topic as string, title: row.title as string, body_markdown: row.body_markdown as string }
}

async function lookupLessonFts(query: string, q: QueryFn): Promise<{ topic: string; title: string; body_markdown: string } | null> {
  // FTS5 query; tolerate parse failures by escaping.
  const safe = query.replace(/['"]/g, " ").trim()
  if (!safe) return null
  const r = await q(
    "SELECT topic, title, body_markdown FROM lessons_fts WHERE lessons_fts MATCH ? LIMIT 1",
    [safe.split(/\s+/).slice(0, 6).join(" OR ")]
  )
  if (!r.rows.length) return null
  const row = r.rows[0]
  return { topic: row.topic as string, title: row.title as string, body_markdown: row.body_markdown as string }
}

// Lessons keyed by colloquial English queries
const DIRECT_TOPIC_MAP: Array<[RegExp, string]> = [
  [/\b(tones?|声调|四声)\b/i, "tones"],
  [/\b(word\s*order|sentence\s*structure|SVO|语序|句子结构)\b/i, "word_order"],
  [/\b(classifiers?|measure\s*words?|量词|个|本|张)\b/i, "classifiers"],
  [/\b(了\s*(le)?|completion|aspect)\b/i, "aspect_le"],
  [/\b(过|experiential|experience)\b/i, "aspect_guo"],
  [/\b(着|ongoing|durative)\b/i, "aspect_zhe"],
  [/\b(把|ba\s*construction|disposal)\b/i, "ba_construction"],
  [/\b(被|bei\s*construction|passive)\b/i, "bei_construction"],
  [/\b(不|没|negation)\b/i, "negation_bu_mei"],
  [/\b(question|吗|呢|how\s*to\s*ask)\b/i, "questions"],
  [/\b(比|compare|comparison)\b/i, "comparison_bi"],
]

const DIFF_PATTERNS: RegExp[] = [
  /\bdifference\s+between\b/i,
  /\bvs\.?\b/i,
  /\b(.+?)\s+和\s+(.+?)\s+的(区别|不同)\b/,
]

// ============================================================
// EXPORTS
// ============================================================

export async function resolveTheme(themeKey: string, queryDb: QueryFn): Promise<string | null> {
  const items = await lookupTheme(themeKey, queryDb)
  if (!items.length) return null
  return formatTheme(items, themeKey)
}

export async function retrieve(userMessage: string, queryDb: QueryFn): Promise<RagResult> {
  const msg = userMessage.trim()
  const log: string[] = []
  if (!msg) return { reference: null, kind: null, log }

  // 1. Theme
  const themeKey = detectThemeKey(msg)
  if (themeKey) {
    const items = await lookupTheme(themeKey, queryDb)
    if (items.length) {
      log.push(`theme: ${themeKey} (${items.length} items)`)
      return { reference: formatTheme(items, themeKey), kind: "theme", themeKey, log }
    }
  }

  // 2. Direct lesson topic match
  for (const [pat, topic] of DIRECT_TOPIC_MAP) {
    if (pat.test(msg)) {
      const lesson = await lookupLessonByTopic(topic, queryDb)
      if (lesson) {
        log.push(`lesson: ${topic}`)
        const kind: RagKind = DIFF_PATTERNS.some((p) => p.test(msg)) ? "lesson_diff" : "lesson"
        return { reference: `# ${lesson.title}\n\n${lesson.body_markdown}`, kind, log }
      }
    }
  }

  // 3. FTS fallback
  const fts = await lookupLessonFts(msg, queryDb)
  if (fts) {
    log.push(`lesson_fts: ${fts.topic}`)
    return { reference: `# ${fts.title}\n\n${fts.body_markdown}`, kind: "lesson", log }
  }

  return { reference: null, kind: null, log }
}
