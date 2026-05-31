/**
 * Spanish RAG retriever — TypeScript port of tools/spanish_rag/retriever.py.
 *
 * Pattern-matches user queries → sqlite lookups (via hostApi.queryPackDb) →
 * formatted reference text + kind tag. No LLM in the loop. Fast, deterministic.
 *
 * The chat UI calls retrieve(userMessage) and gets back { reference, kind, log }.
 * If kind === "theme", the UI delivers the canonical list directly (bypass LLM).
 * Otherwise, the UI injects the reference as a system-message prefix and lets
 * the model compose its response.
 */

import coreVocabRaw from "../data/core_vocab.json"

type CoreVocabEntry = {
  lemma: string
  gender: string
  article: string
  plural: string
  ipa: string
  translation: string
}

const CORE_VOCAB: Record<string, CoreVocabEntry> = coreVocabRaw as Record<string, CoreVocabEntry>

type QueryFn = (sql: string, params?: unknown[]) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>

export type RagKind =
  | "translation"
  | "conjugation_one"
  | "conjugation_full"
  | "lesson"
  | "lesson_diff"
  | "theme"
  | null

export type RagResult = {
  reference: string | null
  kind: RagKind
  log: string[]
}

// ============================================================
// TENSE / MOOD ALIASING
// ============================================================

const TENSE_ALIASES: Record<string, [string, string]> = {
  // indicative
  present: ["indicativo", "presente"],
  presente: ["indicativo", "presente"],
  preterite: ["indicativo", "preterito"],
  preterito: ["indicativo", "preterito"],
  "pretérito": ["indicativo", "preterito"],
  "past simple": ["indicativo", "preterito"],
  "simple past": ["indicativo", "preterito"],
  imperfect: ["indicativo", "imperfecto"],
  imperfecto: ["indicativo", "imperfecto"],
  future: ["indicativo", "futuro"],
  futuro: ["indicativo", "futuro"],
  // conditional
  conditional: ["condicional", "simple"],
  condicional: ["condicional", "simple"],
  // subjunctive
  subjunctive: ["subjuntivo", "presente"],
  subjuntivo: ["subjuntivo", "presente"],
  "present subjunctive": ["subjuntivo", "presente"],
  "imperfect subjunctive": ["subjuntivo", "imperfecto"],
  "subjuntivo imperfecto": ["subjuntivo", "imperfecto"],
  // imperative
  imperative: ["imperativo", "afirmativo"],
  imperativo: ["imperativo", "afirmativo"],
  commands: ["imperativo", "afirmativo"],
}

const PERSON_ORDER = ["yo", "tu", "el", "nosotros", "vosotros", "ellos"] as const
const PERSON_LABEL: Record<string, string> = {
  yo: "yo",
  tu: "tú",
  el: "él/ella/usted",
  nosotros: "nosotros",
  vosotros: "vosotros",
  ellos: "ellos/ellas/ustedes",
}

// ============================================================
// THEME ALIASING (English/Spanish topic → theme key)
// ============================================================

const THEME_ALIASES: Record<string, string> = {
  // food
  food: "comida", foods: "comida", comida: "comida", comidas: "comida",
  kitchen: "cocina", cocina: "cocina",
  // family
  family: "familia", familia: "familia", relatives: "familia", parientes: "familia",
  // body
  body: "cuerpo", cuerpo: "cuerpo", anatomy: "cuerpo",
  "body parts": "cuerpo", "body part": "cuerpo", "partes del cuerpo": "cuerpo",
  // weather
  weather: "tiempo", clima: "tiempo", tiempo: "tiempo",
  // clothing
  clothing: "ropa", clothes: "ropa", ropa: "ropa", outfit: "ropa",
  // house
  house: "casa", home: "casa", casa: "casa", household: "casa",
  // animals
  animals: "animales", animales: "animales", animal: "animales",
  // colors
  colors: "colores", colours: "colores", colores: "colores", color: "colores",
  // transport
  transport: "transporte", transportation: "transporte", transporte: "transporte", vehicles: "transporte",
  // time (clock)
  time: "tiempo_cronologico", clock: "tiempo_cronologico", days: "tiempo_cronologico", months: "tiempo_cronologico",
  // numbers
  numbers: "numeros", "números": "numeros", numeros: "numeros", counting: "numeros",
  // emotions
  emotions: "emociones", "emoción": "emociones", emociones: "emociones",
  feelings: "emociones", sentimientos: "emociones",
  // restaurant
  restaurant: "restaurante", restaurante: "restaurante", dining: "restaurante", ordering: "restaurante",
  // travel
  travel: "viaje", trip: "viaje", viaje: "viaje", viajes: "viaje", tourism: "viaje", vacation: "viaje",
  // shopping
  shopping: "compras", compras: "compras", buying: "compras", store: "compras", stores: "compras",
  // school
  school: "escuela", escuela: "escuela", education: "escuela", classroom: "escuela", studying: "escuela",
  // professions
  professions: "profesiones", jobs: "profesiones", profesiones: "profesiones", careers: "profesiones", trabajos: "profesiones",
  // health
  health: "salud", salud: "salud", medicine: "salud", medical: "salud", doctor: "salud", illness: "salud",
  // technology
  technology: "tecnologia", tech: "tecnologia", tecnologia: "tecnologia",
  "tecnología": "tecnologia", computer: "tecnologia", computers: "tecnologia",
  // sports
  sports: "deportes", deportes: "deportes", deporte: "deportes", sport: "deportes",
  // nature
  nature: "naturaleza", naturaleza: "naturaleza", outdoors: "naturaleza", environment: "naturaleza",
  // greetings
  greetings: "saludos", saludos: "saludos", hellos: "saludos", salutations: "saludos",
  // useful phrases
  phrases: "frases_utiles", "useful phrases": "frases_utiles",
  frases: "frases_utiles", "common phrases": "frases_utiles",
  expressions: "frases_utiles", expresiones: "frases_utiles",
  // music
  music: "musica", musica: "musica", "música": "musica", songs: "musica", instruments: "musica",
}

// ============================================================
// PATTERN MATCHERS
// ============================================================

const VOCAB_PATTERNS = [
  /how (?:do|would) (?:you|i) say ['""]?([\w\s-]+?)['""]?(?:\s+in\s+spanish)?[?.!]?\s*$/i,
  /what(?:'s|s| is)?(?:\s+the)?\s+spanish\s+(?:word|term)\s+(?:for\s+)?['""]?([\w\s-]+?)['""]?[?.!]?\s*$/i,
  /what(?:'s|s| is)\s+['""]?([\w\s-]+?)['""]?\s+in\s+spanish[?.!]?\s*$/i,
  /['""]([\w\s-]+)['""]\s+in spanish/i,
  /\b(?:translate|translation of) ['""]?([\w\s-]+?)['""]?(?:\s+to\s+spanish)?[?.!]?\s*$/i,
  /¿?cómo se dice ['""]?([\w\s-]+?)['""]?(?:\s+en\s+español)?[?.!]?\s*$/i,
  /\bspanish for ['""]?([\w\s-]+?)['""]?[?.!]?\s*$/i,
]

const CONJUG_VERB_PATTERNS = [
  /\bconjugate\s+(?:the verb\s+)?['""]?(\w+)['""]?(?:\s+in\s+(?:the\s+)?([\w\s]+?))?(?:\s+tense)?[?.!]?\s*$/i,
  /\b(?:conjugacion|conjugación)\s+(?:de\s+)?['""]?(\w+)['""]?/i,
  /\b(\w+)\s+in\s+(?:the\s+)?([\w\s]+?)\s+tense/i,
]

const TENSE_LESSON_PATTERNS = [
  /\b(?:teach me|explain|tell me about|what is)\s+(?:the\s+)?([\w\s]+?)(?:\s+tense)?[?.!]?\s*$/i,
  /\b(?:cómo|como)\s+(?:funciona|se forma)\s+(?:el|la)\s+([\w\s]+?)[?.!]?\s*$/i,
  /\bwhat\s+(?:kinds?|types?)\s+of\s+(\w+)/i,
  /\b(?:list|all)\s+(?:the\s+)?(\w+)\s+tenses?/i,
  /\b(\w+)\s+tense\s+(?:most\s+)?common\s+verbs?/i,
  /\b(?:most\s+)?common\s+verbs?\s+in\s+(\w+)/i,
]

const THEME_PATTERNS = [
  /\b(?:teach me|give me|show me|list)\s+(?:some\s+)?([\w\s]+?)\s+(?:vocabulary|words|vocab)/i,
  /\bvocabulary (?:for|about|of)\s+([\w\s]+?)[?.!]?\s*$/i,
  /\b([\w\s]+?)\s+(?:vocabulary|vocab|words)\s*(?:please|por favor)?[?.!]?\s*$/i,
  /\bpalabras (?:de|para|sobre)\s+([\w\s]+?)[?.!]?\s*$/i,
  /\b(\w+)\s+(?:en español)[?.!]?\s*$/i,
  /\b(?:teach me|give me|show me)\s+(?:the\s+|some\s+)?(\w+?)[?.!]?\s*$/i,
]

const DIFF_PATTERNS = [
  /\b(\w+)\s+(?:vs|versus|or|y)\s+(\w+)/i,
  /\bdifference between\s+(\w+)\s+and\s+(\w+)/i,
  /\bdiferencia (?:entre)?\s+(\w+)\s+y\s+(\w+)/i,
]

const DIRECT_TOPIC_MAP: [RegExp, string][] = [
  [/\b(?:accent|accents|tilde|acento|acentos)\b/i, "acentos_reglas"],
  [/\bpronoun(?:\s+ordering|\s+order)\b/i, "pronombres_orden"],
  [/\borden\s+(?:de\s+)?(?:los\s+)?pronombres\b/i, "pronombres_orden"],
  [/\bdirect\s+object\s+pronouns?\b/i, "pronombres_objeto_directo"],
  [/\bindirect\s+object\s+pronouns?\b/i, "pronombres_objeto_indirecto"],
  [/\breflexive\s+(?:pronouns?|verbs?)\b/i, "pronombres_reflexivos"],
  [/\bpronombres\s+reflexivos\b/i, "pronombres_reflexivos"],
  [/\b(?:imperative|imperativo|commands?)\b/i, "imperativo"],
  [/\b(?:gerund|gerundio)\b/i, "gerundio"],
  [/\b(?:participle|participio)\b/i, "participio"],
  [/\b(?:passive\s+voice|voz\s+pasiva|pasiva)\b/i, "voz_pasiva"],
  [/\b(?:impersonal\s+se|se\s+impersonal)\b/i, "se_impersonal"],
  [/\b(?:adjective\s+placement|posici[oó]n\s+(?:de\s+)?adjetivos)\b/i, "adjetivos_posicion"],
  [/\b(?:comparatives?|superlatives?|comparativos?|superlativos?)\b/i, "comparativos"],
  [/\b(?:false\s+friends?|falsos?\s+amigos?)\b/i, "falsos_amigos_en"],
  [/\b(?:articles?|art[ií]culos?)\b/i, "articulos"],
  [/\b(?:t[uú]\s+(?:vs\s+|y\s+|o\s+)usted|usted\s+vs|formal\s+(?:vs|or)\s+informal)\b/i, "tu_usted_vos"],
  [/\b(?:vos|voseo)\b/i, "tu_usted_vos"],
  [/\b(?:negation|negar|negative)\b/i, "preguntar_negacion"],
  [/\b(?:questions?\s+in\s+spanish|asking\s+questions|interrogativ)\b/i, "preguntar_negacion"],
  [/\b(?:present\s+perfect|pret[eé]rito\s+perfecto\s+compuesto|have\s+(?:done|been|eaten|gone))\b/i, "preterito_perfecto_compuesto"],
  [/\b(?:pluperfect|pret[eé]rito\s+pluscuamperfecto|had\s+(?:done|been|eaten))\b/i, "preterito_pluscuamperfecto"],
  [/\b(?:future\s+perfect|futuro\s+perfecto)\b/i, "futuro_perfecto"],
  [/\b(?:imperfect\s+subjunctive|subjuntivo\s+imperfecto|imperfecto\s+de\s+subjuntivo)\b/i, "imperfecto_subjuntivo"],
  [/\bsaber\s+(?:vs|y|o)\s+conocer\b/i, "saber_vs_conocer"],
  [/\b(?:ir\s+a\s+(?:plus\s+)?infinit|going\s+to\s+(?:future|in\s+spanish))\b/i, "ir_a_infinitivo"],
  [/\buse\s+(?:'|")ir\s+a(?:'|")/i, "ir_a_infinitivo"],
  [/\bvoy\s+a\b/i, "ir_a_infinitivo"],
  [/\b(?:estar\s+(?:plus\s+|\+\s+)?gerund|progressive\s+tense|present\s+progressive)\b/i, "estar_gerundio"],
  [/\bestar\s+(?:plus\s+|\+\s+)gerundio\b/i, "estar_gerundio"],
  [/\b(?:hace\s+(?:que|ago)|llevar\s+(?:tiempo|a[ñn]os|gerundio)|how\s+long\s+(?:have|expressions?))\b/i, "hacer_tiempo"],
  [/\bI\s+have\s+been\s+\w+ing\s+for\s+\d+\b/i, "hacer_tiempo"],
  [/\bdesde\s+hace\b/i, "hacer_tiempo"],
  [/\b(?:obligation|tener\s+que|hay\s+que|deber|must|should\s+in\s+spanish)\b/i, "obligacion"],
  [/\b(?:numbers?|n[uú]meros?|cardinal|ordinal|count(?:ing)?(?:\s+in\s+spanish)?)\b/i, "numeros_cardinales_ordinales"],
]

// Order matters: longer / more specific phrases first
const KW_MAP: [string, string][] = [
  ["past participle", "participio"],
  ["participle", "participio"],
  ["participio", "participio"],
  ["false friends", "falsos AND amigos"],
  ["falsos amigos", "falsos AND amigos"],
  ["ser estar", "ser AND estar"],
  ["por para", "por AND para"],
  ["saber conocer", "saber AND conocer"],
  ["present perfect", "perfecto AND compuesto"],
  ["pluperfect", "pluscuamperfecto"],
  ["future perfect", "futuro AND perfecto"],
  ["imperfect subjunctive", "imperfecto AND subjuntivo"],
  ["tu usted", "usted OR vos"],
  ["vosotros", "vosotros OR usted"],
  ["subjunctive", "subjuntivo"],
  ["subjuntivo", "subjuntivo"],
  ["imperative", "imperativo"],
  ["imperativo", "imperativo"],
  ["commands", "imperativo"],
  ["gerundio", "gerundio"],
  ["gerund", "gerundio"],
  ["conditional", "condicional"],
  ["condicional", "condicional"],
  ["imperfect", "imperfecto"],
  ["preterite", "preterito"],
  ["future", "futuro"],
  ["present", "presente"],
  ["pronouns", "pronombres"],
  ["pronombres", "pronombres"],
  ["passive", "pasiva"],
  ["pasiva", "pasiva"],
  ["voice", "pasiva"],
  ["reflexive", "reflexivos"],
  ["reflexivos", "reflexivos"],
  ["accents", "acentos"],
  ["acentos", "acentos"],
  ["tilde", "acentos"],
  ["comparatives", "comparativos"],
  ["comparativos", "comparativos"],
  ["superlatives", "comparativos"],
  ["articles", "articulos"],
  ["articulos", "articulos"],
  ["vos", "usted OR vos"],
  ["negation", "negacion"],
  ["negar", "negacion"],
  ["questions", "preguntar"],
  ["preguntar", "preguntar"],
  ["past", "preterito OR imperfecto"],
  ["pasado", "preterito OR imperfecto"],
  ["tenses", "presente OR preterito OR futuro OR subjuntivo"],
  ["tiempos", "presente OR preterito OR futuro OR subjuntivo"],
]

// ============================================================
// HELPERS
// ============================================================

async function lookupNoun(word: string, q: QueryFn): Promise<CoreVocabEntry | null> {
  const w = word.trim().toLowerCase()

  // 1. CORE_VOCAB curated overrides
  if (CORE_VOCAB[w]) return CORE_VOCAB[w]

  // 2. Exact Spanish lemma match
  const r1 = await q("SELECT lemma, gender, article, plural, ipa, glosses_en AS translation FROM nouns WHERE lemma = ? AND glosses_en IS NOT NULL LIMIT 1", [w])
  if (r1.rows.length) {
    const r = r1.rows[0] as CoreVocabEntry & { translation: string }
    const firstGloss = (r.translation ?? "").split("|")[0].trim().toLowerCase()
    if (firstGloss && firstGloss !== w && !firstGloss.startsWith("alternative spelling")) {
      return r
    }
  }

  // 3. Word-boundary first-gloss match
  const r2 = await q(
    "SELECT lemma, gender, article, plural, ipa, glosses_en AS translation FROM nouns WHERE glosses_en LIKE ? AND lemma NOT GLOB '*[ -]*' ORDER BY length(lemma) LIMIT 50",
    [`%${w}%`]
  )
  const boundary = new RegExp(`\\b${escapeRegex(w)}\\b`, "i")
  for (const row of r2.rows) {
    const r = row as CoreVocabEntry & { translation: string }
    const first = (r.translation ?? "").split("|")[0].trim()
    if (boundary.test(first)) return r
  }
  for (const row of r2.rows) {
    const r = row as CoreVocabEntry & { translation: string }
    if (boundary.test(r.translation ?? "")) return r
  }
  return null
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function formatNoun(n: CoreVocabEntry): string {
  const art = n.article ?? ""
  const g = n.gender ?? ""
  const gLabel = ({ m: "masculino", f: "femenino", "m/f": "masculino/femenino" } as Record<string, string>)[g] ?? ""
  const ipa = n.ipa ?? ""
  const pl = n.plural ?? ""
  const tr = n.translation ?? ""
  const parts: string[] = []
  parts.push(`**${art ? art + " " : ""}${n.lemma}**`)
  if (gLabel) parts.push(`(${gLabel})`)
  if (ipa) parts.push(`/${ipa.replace(/^\/|\/$/g, "")}/`)
  let out = parts.join(" ")
  if (pl && pl !== n.lemma) {
    const plArt = art.replace("el", "los").replace("la", "las")
    out += art ? `\n- Plural: **${plArt} ${pl}**` : `\n- Plural: **${pl}**`
  }
  if (tr) out += `\n- English: ${tr}`
  return out
}

async function lookupConjugation(
  infinitive: string, mood: string | null, tense: string | null, q: QueryFn
): Promise<Array<{ person: string; form: string; is_vos: number; mood?: string; tense?: string }>> {
  if (mood && tense) {
    const r = await q(
      "SELECT person, form, is_vos_form AS is_vos FROM verbs WHERE infinitive = ? AND mood = ? AND tense = ? ORDER BY person, is_vos_form",
      [infinitive, mood, tense]
    )
    return r.rows as Array<{ person: string; form: string; is_vos: number }>
  }
  const r = await q(
    "SELECT mood, tense, person, form, is_vos_form AS is_vos FROM verbs WHERE infinitive = ? ORDER BY mood, tense, person, is_vos_form",
    [infinitive]
  )
  return r.rows as Array<{ mood: string; tense: string; person: string; form: string; is_vos: number }>
}

function formatConjugTable(
  rows: Array<{ person: string; form: string; is_vos: number }>, inf: string, mood: string, tense: string
): string {
  const byPerson: Record<string, { std: string | null; vos: string | null }> = {}
  for (const p of PERSON_ORDER) byPerson[p] = { std: null, vos: null }
  for (const r of rows) {
    if (!byPerson[r.person]) continue
    byPerson[r.person][r.is_vos ? "vos" : "std"] = r.form
  }
  const lines = [`### ${inf} — ${mood} ${tense}`]
  for (const p of PERSON_ORDER) {
    const { std, vos } = byPerson[p]
    if (!std && !vos) continue
    let forms = std ?? "—"
    if (vos && vos !== std) forms += `  (vos: ${vos})`
    lines.push(`- **${PERSON_LABEL[p]}**: ${forms}`)
  }
  return lines.join("\n")
}

function formatFullConjugation(
  rows: Array<{ mood: string; tense: string; person: string; form: string; is_vos: number }>, inf: string
): string {
  const byMT: Record<string, typeof rows> = {}
  for (const r of rows) {
    const k = `${r.mood}|${r.tense}`
    if (!byMT[k]) byMT[k] = []
    byMT[k].push(r)
  }
  const priority: [string, string][] = [
    ["indicativo", "presente"],
    ["indicativo", "preterito"],
    ["indicativo", "imperfecto"],
    ["indicativo", "futuro"],
    ["condicional", "simple"],
    ["subjuntivo", "presente"],
    ["subjuntivo", "imperfecto"],
    ["imperativo", "afirmativo"],
  ]
  const sections: string[] = []
  const seen = new Set<string>()
  for (const [m, t] of priority) {
    const k = `${m}|${t}`
    if (byMT[k]) {
      sections.push(formatConjugTable(byMT[k], inf, m, t))
      seen.add(k)
    }
  }
  for (const k of Object.keys(byMT)) {
    if (!seen.has(k)) {
      const [m, t] = k.split("|")
      sections.push(formatConjugTable(byMT[k], inf, m, t))
    }
  }
  return `# Conjugación de **${inf}**\n\n${sections.join("\n\n")}`
}

async function lookupLessonByTopic(topic: string, q: QueryFn): Promise<{ topic: string; title: string; body_markdown: string } | null> {
  const r = await q("SELECT topic, title, body_markdown FROM lessons WHERE topic = ? LIMIT 1", [topic])
  if (r.rows.length) return r.rows[0] as any
  // FTS fallback
  try {
    const fts = await q("SELECT topic FROM lessons_fts WHERE lessons_fts MATCH ? LIMIT 1", [topic])
    if (fts.rows.length) {
      const t = (fts.rows[0] as any).topic
      const r2 = await q("SELECT topic, title, body_markdown FROM lessons WHERE topic = ? LIMIT 1", [t])
      if (r2.rows.length) return r2.rows[0] as any
    }
  } catch {
    /* FTS may not be available */
  }
  return null
}

async function lookupLessonFts(query: string, q: QueryFn): Promise<{ topic: string; body_markdown: string } | null> {
  try {
    const fts = await q("SELECT topic FROM lessons_fts WHERE lessons_fts MATCH ? ORDER BY rank LIMIT 1", [query])
    if (fts.rows.length) {
      const t = (fts.rows[0] as any).topic
      const r = await q("SELECT topic, body_markdown FROM lessons WHERE topic = ? LIMIT 1", [t])
      if (r.rows.length) return r.rows[0] as any
    }
  } catch {
    /* */
  }
  return null
}

async function lookupTheme(themeKey: string, q: QueryFn): Promise<Array<{ position: number; spanish: string; english: string; category: string }>> {
  const r = await q("SELECT position, spanish, english, category FROM vocabulary_themes WHERE theme = ? ORDER BY position", [themeKey])
  return r.rows as any
}

const THEME_TITLES: Record<string, string> = {
  comida: "Comida (food)",
  cocina: "Cocina (kitchen)",
  familia: "Familia (family)",
  cuerpo: "El cuerpo (body)",
  tiempo: "El tiempo / clima (weather)",
  ropa: "La ropa (clothing)",
  casa: "La casa (home)",
  animales: "Animales (animals)",
  colores: "Colores (colors)",
  transporte: "Transporte (transportation)",
  tiempo_cronologico: "Tiempo / días / horas (time)",
  numeros: "Números (numbers)",
  emociones: "Emociones (emotions)",
  restaurante: "Restaurante (restaurant)",
  viaje: "Viaje (travel)",
  compras: "Compras (shopping)",
  escuela: "Escuela (school)",
  profesiones: "Profesiones (professions)",
  salud: "Salud (health)",
  tecnologia: "Tecnología (technology)",
  deportes: "Deportes (sports)",
  naturaleza: "Naturaleza (nature)",
  saludos: "Saludos (greetings)",
  frases_utiles: "Frases útiles (useful phrases)",
  musica: "Música (music)",
}

function formatTheme(items: Array<{ spanish: string; english: string }>, themeKey: string): string {
  const title = THEME_TITLES[themeKey] ?? themeKey
  const lines = [`# ${title}`, ""]
  for (const it of items) lines.push(`- **${it.spanish}** — ${it.english}`)
  return lines.join("\n")
}

// ============================================================
// MAIN
// ============================================================

/** Direct theme lookup, bypassing the LLM. Returns the canonical markdown list
 *  or null if the themeKey is unknown / empty. Used by the Tutomaton shell's
 *  theme-bypass code path. */
export async function resolveTheme(themeKey: string, queryDb: QueryFn): Promise<string | null> {
  const items = await lookupTheme(themeKey, queryDb)
  if (!items.length) return null
  return formatTheme(items, themeKey)
}

export async function retrieve(userMessage: string, queryDb: QueryFn): Promise<RagResult> {
  const msg = userMessage.trim()
  const log: string[] = []
  if (!msg) return { reference: null, kind: null, log }

  const pieces: string[] = []
  let kind: RagKind = null

  // VOCAB
  for (const pat of VOCAB_PATTERNS) {
    const m = msg.match(pat)
    if (m && m[1]) {
      const word = m[1].trim()
      const n = await lookupNoun(word, queryDb)
      if (n) {
        log.push(`vocab: '${word}' → ${n.article} ${n.lemma}`)
        pieces.push(`## Translation lookup\n\n${formatNoun(n)}`)
        kind = "translation"
        break
      }
    }
  }

  // CONJUGATION
  if (!pieces.length) {
    for (const pat of CONJUG_VERB_PATTERNS) {
      const m = msg.match(pat)
      if (m && m[1]) {
        const verb = m[1].trim().toLowerCase()
        const tenseStr = ((m[2] ?? "") + "").trim().toLowerCase()
        const existsResult = await queryDb("SELECT COUNT(*) AS c FROM verbs WHERE infinitive = ?", [verb])
        const exists = (existsResult.rows[0] as any).c > 0
        if (exists) {
          const mt = TENSE_ALIASES[tenseStr]
          if (mt) {
            const rows = await lookupConjugation(verb, mt[0], mt[1], queryDb)
            if (rows.length) {
              log.push(`conjugation: ${verb} / ${mt[0]} ${mt[1]}`)
              pieces.push(formatConjugTable(rows as any, verb, mt[0], mt[1]))
              kind = "conjugation_one"
            }
          } else {
            const rows = await lookupConjugation(verb, null, null, queryDb)
            if (rows.length) {
              log.push(`conjugation: ${verb} (all tenses, ${rows.length} forms)`)
              pieces.push(formatFullConjugation(rows as any, verb))
              kind = "conjugation_full"
            }
          }
          break
        }
      }
    }
  }

  // TENSE LESSON
  if (!pieces.length) {
    for (const pat of TENSE_LESSON_PATTERNS) {
      const m = msg.match(pat)
      if (m && m[1]) {
        const topicStr = m[1].trim().toLowerCase()
        const mt = TENSE_ALIASES[topicStr]
        if (mt) {
          const topicMap: Record<string, string> = {
            "indicativo|presente": "presente_indicativo",
            "indicativo|preterito": "preterito_perfecto_simple",
            "indicativo|imperfecto": "preterito_imperfecto",
            "indicativo|futuro": "futuro_simple",
            "condicional|simple": "condicional_simple",
            "subjuntivo|presente": "presente_subjuntivo",
            "subjuntivo|imperfecto": "imperfecto_subjuntivo",
            "imperativo|afirmativo": "imperativo",
          }
          const topicId = topicMap[`${mt[0]}|${mt[1]}`]
          if (topicId) {
            const l = await lookupLessonByTopic(topicId, queryDb)
            if (l) {
              log.push(`lesson: ${topicId}`)
              pieces.push(l.body_markdown)
              const ex = await lookupConjugation("hablar", mt[0], mt[1], queryDb)
              if (ex.length) {
                pieces.push(`---\n\n**Ejemplo: hablar**\n\n${formatConjugTable(ex as any, "hablar", mt[0], mt[1])}`)
              }
              kind = "lesson"
              break
            }
          }
        }
      }
    }
  }

  // THEME
  if (!pieces.length) {
    for (const pat of THEME_PATTERNS) {
      const m = msg.match(pat)
      if (m && m[1]) {
        const phrase = m[1].trim().toLowerCase()
        const candidates = [phrase, ...phrase.split(/\s+/)]
        let themeKey: string | null = null
        for (const c of candidates) {
          if (THEME_ALIASES[c]) {
            themeKey = THEME_ALIASES[c]
            break
          }
        }
        if (themeKey) {
          const items = await lookupTheme(themeKey, queryDb)
          if (items.length) {
            log.push(`theme: ${themeKey} (${items.length} items)`)
            pieces.push(formatTheme(items, themeKey))
            kind = "theme"
            break
          }
        }
      }
    }
  }

  // THEME bare-probe
  if (!pieces.length) {
    let clean = msg.toLowerCase().replace(/[?!.,;\s]+$/, "")
    clean = clean.replace(/\s+(please|por favor|in spanish|en español)$/i, "")
    const bare = clean.replace(/^(useful|common|basic|important|please|some|the)\s+/i, "").trim()
    const tryKey = (k: string) => {
      if (THEME_ALIASES[k]) {
        return THEME_ALIASES[k]
      }
      return null
    }
    const tk = tryKey(bare) ?? tryKey(clean)
    if (tk) {
      const items = await lookupTheme(tk, queryDb)
      if (items.length) {
        log.push(`theme (bare-probe): ${tk} (${items.length} items)`)
        pieces.push(formatTheme(items, tk))
        kind = "theme"
      }
    }
  }

  // DIFFERENCE / topic
  if (!pieces.length) {
    for (const pat of DIFF_PATTERNS) {
      const m = msg.match(pat)
      if (m && m[1] && m[2]) {
        const a = m[1].trim().toLowerCase()
        const b = m[2].trim().toLowerCase()
        for (const cand of [`${a}_vs_${b}`, `${b}_vs_${a}`]) {
          const l = await lookupLessonByTopic(cand, queryDb)
          if (l) {
            log.push(`lesson: ${l.topic} (diff)`)
            pieces.push(l.body_markdown)
            kind = "lesson_diff"
            break
          }
        }
        if (pieces.length) break
        const l = await lookupLessonFts(`${a} ${b}`, queryDb)
        if (l) {
          log.push(`lesson (FTS fallback): ${l.topic}`)
          pieces.push(l.body_markdown)
          kind = "lesson"
          break
        }
      }
    }
  }

  // DIRECT TOPIC LOOKUP
  if (!pieces.length) {
    for (const [pat, topic] of DIRECT_TOPIC_MAP) {
      if (pat.test(msg)) {
        const l = await lookupLessonByTopic(topic, queryDb)
        if (l) {
          log.push(`lesson (direct): ${topic}`)
          pieces.push(l.body_markdown)
          kind = "lesson"
          break
        }
      }
    }
  }

  // GENERIC LESSON FTS keyword
  if (!pieces.length) {
    const msgLow = msg.toLowerCase()
    let matchedKw: string | null = null
    for (const [term, ftsQuery] of KW_MAP) {
      if (new RegExp(`\\b${escapeRegex(term)}\\b`).test(msgLow)) {
        matchedKw = ftsQuery
        break
      }
    }
    if (matchedKw) {
      const l = await lookupLessonFts(matchedKw, queryDb)
      if (l) {
        log.push(`lesson (FTS keyword): ${l.topic}`)
        pieces.push(l.body_markdown)
        kind = "lesson"
      }
    }
  }

  if (!pieces.length) return { reference: null, kind: null, log }
  return { reference: pieces.join("\n\n---\n\n"), kind, log }
}
