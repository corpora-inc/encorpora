export type SafeRelayChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type SafeRelayChatOptions = {
  temperature?: number
  topP?: number
  repeatPenalty?: number
  maxTokens?: number
  stop?: string[]
}

export type SafeRelayRunLlm = (
  messages: SafeRelayChatMessage[],
  options: SafeRelayChatOptions,
  label: string,
) => Promise<string>

export type SafeRelayState = "send" | "replaced" | "blocked"

export type SafePhraseSampler = (language: string) => Promise<string | null | undefined>

export type SafeRelayPipelineOptions = {
  runLlm: SafeRelayRunLlm
  sampleSafePhrase?: SafePhraseSampler
  maxText?: number
  maxContextMessages?: number
}

export type PrepareSafeRelayArgs = {
  text: string
  sourceLanguage: string
  targetLanguage?: string
  scope?: string
  recentRawMessages?: string[]
}

export type SafeRelayOutbound = {
  state: SafeRelayState
  relayText: string
  reasons: string[]
}

export type LessonifySafeRelayArgs = {
  relayText: string
  targetLanguage: string
  nativeLanguage: string
  level?: string
}

export type SafeRelayLesson = {
  state: SafeRelayState
  relayText: string
  targetText: string
  nativeText: string
  suggestedReplies: string[]
  note?: string
  reasons: string[]
}

export type RandomEntryTranslation = {
  language_code: string
  text: string
  romanization?: string
}

export type RandomEntry = {
  translations?: RandomEntryTranslation[]
}

export type SafePhraseHost = {
  getRandomEntries?: (
    q: number | { count: number; domains?: string[]; levels?: string[]; languageCodes?: string[] },
  ) => Promise<RandomEntry[]>
  getRandomEntry?: () => Promise<RandomEntry>
}

const DEFAULT_MAX_TEXT = 280
const DEFAULT_MAX_CONTEXT = 6
const MAX_REPLY_TEXT = 80

const CONTACT_INFO =
  /(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|@\w{2,}|\+?\d[\d\s().-]{6,}\d|(?:^|[^\p{L}\p{N}])@[a-z0-9_.-]{2,})/iu

const DIGIT_HEAVY = /(?:\D*\d){7,}/
const US_STATE_NAMES = [
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west virginia",
  "wisconsin",
  "wyoming",
]
const US_STATE_ABBR = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
]
function titleWords(value: string): string {
  return value.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase())
}

const US_REGION_RE = [...US_STATE_NAMES.map(titleWords), ...US_STATE_ABBR].map((part) => part.replace(/\s+/g, "\\s+")).join("|")
const CITY_STATE_PLACE =
  new RegExp(`\\b\\p{Lu}[\\p{L}.'-]+(?:\\s+\\p{Lu}[\\p{L}.'-]+){0,2}\\s*,?\\s+(?:${US_REGION_RE})\\b`, "u")

const STATIC_SAFE_PHRASES = [
  "Let's talk about music, food, and small adventures.",
  "I am learning something new today.",
  "The city feels bright today.",
  "What is a friendly phrase you like?",
  "Let's practice a simple sentence together.",
  "A good conversation can start with a kind question.",
]

// The semantic-harm passes — categories a deterministic filter cannot catch, so
// they rely on the model. Run only when the risk probe escalates (clean lines
// skip straight to the creative-polish pass). Privacy/contact/place are handled
// deterministically by scrubText() + the usableModelText guards, so they no
// longer need their own model passes.
const SEMANTIC_PASSES = [
  {
    label: "adult-tone",
    focus:
      "Remove all sexual meaning, flirting pressure, romantic pressure, innuendo, body comments, age-gap weirdness, and grooming. Turn it into playful, non-romantic talk. Keep at most one safe trace, such as a mood, color, food, song, animal, joke, or kind of place.",
  },
  {
    label: "violence-coercion",
    focus:
      "Remove all threats, weapons, intimidation, revenge, forced action, self-harm pressure, and violent images. Turn it into a harmless challenge, game, small mystery, weather note, adventure idea, or calm feeling.",
  },
  {
    label: "hate-abuse",
    focus:
      "Remove all slurs, group attacks, demeaning claims, bullying, humiliation, and coded insults. Turn it into a friendly line about people, curiosity, ordinary life, food, animals, travel, music, games, or learning.",
  },
]

// Always-run final pass: make the line natural and a little interesting, and as a
// last resort drop unsafe meaning entirely and improvise from a safe phrase seed.
const POLISH_FOCUS =
  "Make the line short, natural, and a little interesting, like something a real person would actually send in a chat. If it still feels unsafe, private, coded, sexual, hateful, violent, or too specific, drop its meaning completely and write a fresh line built from one of the safe phrase seeds."

// Deterministic pre-model scrub: replace obvious contact/identity material with
// vague wording before the model ever sees the line. Boring on purpose — the
// model is never trusted to decide whether a phone number is okay.
const CITY_STATE_PLACE_G = new RegExp(CITY_STATE_PLACE.source, "gu")
const SCRUB_RULES: Array<[RegExp, string]> = [
  [/\b(?:https?:\/\/|www\.)\S+/giu, "a link"],
  [/[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu, "someone"],
  [/(^|[^\p{L}\p{N}])@[a-z0-9_.-]{2,}/giu, "$1someone"],
  [/\+?\d[\d\s().-]{6,}\d/gu, "a number"],
]

function scrubText(text: string, maxText: number): string {
  let t = text
  for (const [re, repl] of SCRUB_RULES) t = t.replace(re, repl)
  t = t.replace(CITY_STATE_PLACE_G, "a nearby place")
  return bounded(t.replace(/\s+/g, " "), maxText)
}

// Cheap risk router: decides whether to run the full semantic cascade or skip
// straight to polish. Runs on the English-normalized line. Errs toward escalation;
// false negatives still pass through polish + the recipient re-clean.
const HARM_LEXICON =
  /\b(sex|sexual|sexy|nude|naked|horny|porn|boobs?|tits?|dick|cock|pussy|penis|vagina|rape|kill|murder|shoot|gun|knife|bomb|stab|behead|hang|suicide|self[-\s]?harm|cut myself|hate|nazi|hitler|slur|retard|faggot|fag|nigg|kike|spic|chink|tranny|whore|slut|bitch|terrorist|jihad|meet me|our secret|don'?t tell|mature for your age|kys|kill yourself)\b/i

function riskProbe(english: string, scrubbed: string): boolean {
  if (!sameish(english, scrubbed)) return true
  if (leaksContactOrCode(english) || leaksSpecificPlace(english)) return true
  return HARM_LEXICON.test(english)
}

// CEFR band phrasing, authored IN each language so the (in-language) translation
// prompt stays entirely in the destination language. `en` is the seed/fallback;
// the rest are generated. Keys are base codes; resolved by exact then base code.
type LevelBands = { a: string; b: string; c: string }
const LEVEL_BANDS: Record<string, LevelBands> = {
  en: {
    a: "Use very simple, common words and short sentences.",
    b: "Use natural, everyday wording.",
    c: "Use rich, precise, eloquent wording.",
  },
}

function bandTier(level?: string): keyof LevelBands {
  const code = normalize(level ?? "").slice(0, 2)
  if (code === "a0" || code === "a1" || code === "a2") return "a"
  if (code === "c1" || code === "c2") return "c"
  return "b"
}

function levelBand(language: string, level?: string): string {
  const bands =
    LEVEL_BANDS[language] ?? LEVEL_BANDS[language.split("-")[0] ?? ""] ?? LEVEL_BANDS.en
  return bands[bandTier(level)]
}

export const OUTPUT_LANGUAGE_PRIMES: Record<string, string> = {
  en: "Write only the natural English translation. Do not add an explanation.",
  es: "Escribe solo la traducción en español natural. No añadas explicación.",
  ar: "اكتب الترجمة فقط باللغة العربية الطبيعية. لا تضف شرحًا.",
  bg: "Напиши само превода на естествен български. Не добавяй обяснение.",
  bn: "শুধু স্বাভাবিক বাংলায় অনুবাদটি লিখুন। কোনো ব্যাখ্যা যোগ করবেন না।",
  ca: "Escriu només la traducció en català natural. No afegeixis cap explicació.",
  cs: "Napiš pouze překlad v přirozené češtině. Nepřidávej vysvětlení.",
  da: "Skriv kun oversættelsen på naturligt dansk. Tilføj ikke en forklaring.",
  de: "Schreibe nur die Übersetzung in natürlichem Deutsch. Füge keine Erklärung hinzu.",
  el: "Γράψε μόνο τη μετάφραση σε φυσικά ελληνικά. Μην προσθέτεις εξήγηση.",
  fa: "فقط ترجمه را به فارسی طبیعی بنویس. توضیح اضافه نکن.",
  fi: "Kirjoita vain käännös luonnollisella suomella. Älä lisää selitystä.",
  fr: "Écris seulement la traduction en français naturel. N'ajoute pas d'explication.",
  gu: "ફક્ત સ્વાભાવિક ગુજરાતીમાં અનુવાદ લખો. કોઈ સમજાવટ ઉમેરશો નહીં.",
  he: "כתוב רק את התרגום בעברית טבעית. אל תוסיף הסבר.",
  hi: "केवल स्वाभाविक हिंदी में अनुवाद लिखें। कोई व्याख्या न जोड़ें।",
  hr: "Napiši samo prijevod na prirodnom hrvatskom. Nemoj dodavati objašnjenje.",
  hu: "Csak a természetes magyar fordítást írd le. Ne adj hozzá magyarázatot.",
  id: "Tulis hanya terjemahan dalam bahasa Indonesia yang alami. Jangan tambahkan penjelasan.",
  it: "Scrivi solo la traduzione in italiano naturale. Non aggiungere spiegazioni.",
  ja: "自然な日本語の翻訳だけを書いてください。説明は不要です。",
  kn: "ಸ್ವಾಭಾವಿಕ ಕನ್ನಡದಲ್ಲಿ ಅನುವಾದವನ್ನು ಮಾತ್ರ ಬರೆಯಿರಿ. ವಿವರಣೆ ಸೇರಿಸಬೇಡಿ.",
  ko: "자연스러운 한국어 번역만 쓰세요. 설명은 쓰지 마세요.",
  "ko-polite": "자연스럽고 공손한 한국어 번역만 쓰세요. 설명은 쓰지 마세요.",
  lt: "Rašyk tik vertimą natūralia lietuvių kalba. Nepridėk paaiškinimo.",
  mr: "फक्त नैसर्गिक मराठीत अनुवाद लिहा. कोणतेही स्पष्टीकरण जोडू नका.",
  ms: "Tulis hanya terjemahan dalam bahasa Melayu yang semula jadi. Jangan tambah penjelasan.",
  ne: "स्वाभाविक नेपालीमा अनुवाद मात्र लेख्नुहोस्। कुनै व्याख्या नथप्नुहोस्।",
  nl: "Schrijf alleen de vertaling in natuurlijk Nederlands. Voeg geen uitleg toe.",
  no: "Skriv bare oversettelsen på naturlig norsk. Ikke legg til forklaring.",
  "pa-Arab": "صرف قدرتی پنجابی شاہ مکھی وچ ترجمہ لکھو۔ کوئی وضاحت شامل نہ کرو۔",
  "pa-Guru": "ਸਿਰਫ਼ ਕੁਦਰਤੀ ਪੰਜਾਬੀ ਗੁਰਮੁਖੀ ਵਿੱਚ ਅਨੁਵਾਦ ਲਿਖੋ। ਕੋਈ ਵਿਆਖਿਆ ਨਾ ਜੋੜੋ।",
  pl: "Napisz tylko tłumaczenie naturalną polszczyzną. Nie dodawaj wyjaśnień.",
  "pt-BR": "Escreva apenas a tradução em português brasileiro natural. Não acrescente explicação.",
  "pt-PT": "Escreve apenas a tradução em português europeu natural. Não acrescentes explicação.",
  ro: "Scrie doar traducerea în română naturală. Nu adăuga explicații.",
  ru: "Напиши только перевод на естественном русском. Не добавляй объяснений.",
  sk: "Napíš iba preklad v prirodzenej slovenčine. Nepridávaj vysvetlenie.",
  sl: "Napiši samo prevod v naravni slovenščini. Ne dodajaj razlage.",
  sr: "Напиши само превод на природном српском. Не додај објашњење.",
  sv: "Skriv bara översättningen på naturlig svenska. Lägg inte till någon förklaring.",
  sw: "Andika tafsiri tu kwa Kiswahili cha kawaida. Usiongeze maelezo.",
  ta: "இயல்பான தமிழில் மொழிபெயர்ப்பை மட்டும் எழுதுங்கள். விளக்கம் சேர்க்க வேண்டாம்.",
  te: "సహజమైన తెలుగులో అనువాదాన్ని మాత్రమే రాయండి. వివరణను జోడించవద్దు.",
  th: "เขียนเฉพาะคำแปลภาษาไทยที่เป็นธรรมชาติ ไม่ต้องอธิบาย",
  tr: "Yalnızca doğal Türkçe çeviriyi yaz. Açıklama ekleme.",
  uk: "Напиши лише переклад природною українською. Не додавай пояснень.",
  ur: "صرف فطری اردو میں ترجمہ لکھیں۔ کوئی وضاحت شامل نہ کریں۔",
  vi: "Chỉ viết bản dịch bằng tiếng Việt tự nhiên. Đừng thêm lời giải thích.",
  "zh-Hans": "只写自然的简体中文译文，不要解释。",
  "zh-Hant": "只寫自然的繁體中文譯文，不要解釋。",
  "yue-Hant-HK": "只寫自然嘅廣東話繁體中文譯文，唔好解釋。",
}

// Full translation system prompts authored IN the destination language/script.
// A small on-device model translates better when its whole instruction is in the
// target language. `{level}` is replaced with the in-language CEFR band phrase.
// `en` is the seed; the rest are generated. When a language is absent here,
// translateOutPrompt() falls back to OUTPUT_LANGUAGE_PRIMES + an English body.
export const TRANSLATION_DIRECTIVES: Record<string, string> = {
  en: "Rewrite the following line in natural English. {level} Output only the rewritten line — no answer, explanation, notes, quotes, labels, or warnings, and do not continue the conversation.",
}

function bounded(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
}

function isEnglish(code: string): boolean {
  return normalize(code).startsWith("en")
}

function sameish(a: string, b: string): boolean {
  return normalize(a) === normalize(b)
}

function stripPlainModelText(raw: string, maxText: number): string {
  let text = bounded(raw, maxText * 2)
  const fence = text.match(/```(?:text)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) text = fence[1].trim()
  text = text
    .replace(/^(?:safe relay text|relay text|rewritten text|translation|answer|output)\s*:\s*/i, "")
    .replace(/^["“”']+|["“”']+$/g, "")
    .trim()
  return bounded(text, maxText)
}

function looksLikeProtocolJunk(text: string): boolean {
  const t = normalize(text)
  return (
    !t ||
    /^[{[]/.test(t) ||
    /^safe\s+\w{3,20}$/.test(t) ||
    /\b(as an ai|i can'?t assist|i cannot assist|policy|unsupported claim|fact[- ]?check|not appropriate)\b/.test(t)
  )
}

function leaksContactOrCode(text: string): boolean {
  return CONTACT_INFO.test(text) || DIGIT_HEAVY.test(text)
}

function leaksSpecificPlace(text: string): boolean {
  return CITY_STATE_PLACE.test(text)
}

function usableModelText(raw: string, maxText: number): string {
  const text = stripPlainModelText(raw, maxText)
  if (looksLikeProtocolJunk(text)) return ""
  if (leaksContactOrCode(text)) return ""
  if (leaksSpecificPlace(text)) return ""
  return text
}

function fallbackIndex(language: string): number {
  let n = 0
  for (const ch of language) n = (n * 31 + ch.charCodeAt(0)) >>> 0
  return n % STATIC_SAFE_PHRASES.length
}

async function fallbackPhrase(
  language: string,
  sampleSafePhrase: SafePhraseSampler | undefined,
  maxText: number,
): Promise<string> {
  const sampled = sampleSafePhrase
    ? usableModelText((await sampleSafePhrase(language).catch(() => "")) ?? "", maxText)
    : ""
  return sampled || STATIC_SAFE_PHRASES[fallbackIndex(language)] || STATIC_SAFE_PHRASES[0]
}

function formatContext(messages: string[], maxText: number): string {
  const trimmed = messages.map((m) => bounded(m, maxText)).filter(Boolean)
  if (trimmed.length === 0) return "(none)"
  return trimmed.map((m, i) => `${i + 1}. ${m}`).join("\n")
}

function normalizePrompt(sourceLanguage: string): SafeRelayChatMessage {
  return {
    role: "system",
    content:
      "Rewrite this chat message as one simple, natural English line. " +
      "Output only the English line. Do not answer it, explain, warn, or add labels. " +
      "Keep the harmless meaning, tone, and humor. " +
      "Turn any names, handles, contact details, exact places, sexual content, grooming, threats, weapons, hate, or hidden codes into vague, harmless everyday wording. " +
      `Declared language: ${sourceLanguage}.`,
  }
}

function driftPrompt(focus: string): SafeRelayChatMessage {
  return {
    role: "system",
    content:
      "Rewrite this one English chat line into a safer, more interesting chat line. " +
      "Output only the rewritten line. " +
      "Do not answer the speaker, give advice, explain, refuse, mention rules or safety, or act like an assistant or a teacher. " +
      "Transform the line. You may change the subject. " +
      "Keep only one safe trace from the source — a mood, object, setting, joke, color, animal, food, sound, weather, activity, or feeling — and drop anything unsafe. " +
      "Change specific people into vague people and specific places into vague places. " +
      "Keep it easy to translate. " +
      focus,
  }
}

function driftUser(context: string[], current: string, seeds: string[], maxText: number): SafeRelayChatMessage {
  const seedBlock = seeds.length
    ? "\n\nSafe phrase seeds (use one silently only if the line is unsafe or empty — never copy it):\n" +
      seeds.map((s, i) => `${i + 1}. ${bounded(s, maxText)}`).join("\n")
    : ""
  return {
    role: "user",
    content:
      "Recent local messages, private context only:\n" +
      `${formatContext(context, maxText)}\n\n` +
      "Current relay text:\n" +
      current +
      seedBlock,
  }
}

function recleanPrompt(): SafeRelayChatMessage {
  return {
    role: "system",
    content:
      "Rewrite this already-prepared English chat line one more time before it is shown. " +
      "Output only the cleaned line. Do not answer, explain, warn, label, teach, or add facts. " +
      "Remove any leftover names, exact places, contact details, sexual tone, grooming, threats, weapons, hate, insults, hidden codes, or assistant-like wording. " +
      "Keep only a loose safe topic or mood. Make it short and natural, safe for young children.",
  }
}

function recomposeFromSeedPrompt(seed: string): SafeRelayChatMessage {
  return {
    role: "system",
    content:
      "Write one short, natural English chat line. Ignore any earlier message completely. " +
      `Use this seed only as loose inspiration — do not copy it: ${seed}. ` +
      "Output only the line. No names, exact places, contact details, or assistant wording.",
  }
}

function resolvePrime(language: string): string | undefined {
  return OUTPUT_LANGUAGE_PRIMES[language] ?? OUTPUT_LANGUAGE_PRIMES[language.split("-")[0] ?? ""]
}

function translateOutPrompt(language: string, level?: string): SafeRelayChatMessage {
  // Prefer a fully in-language directive (best for non-Latin scripts); fall back to
  // an English body primed with the in-language sentence only when one is missing.
  const directive = TRANSLATION_DIRECTIVES[language] ?? TRANSLATION_DIRECTIVES[language.split("-")[0] ?? ""]
  if (directive) {
    return { role: "system", content: directive.replace("{level}", levelBand(language, level)) }
  }
  const prime = resolvePrime(language)
  return {
    role: "system",
    content:
      (prime ? `${prime} ` : "") +
      `Translate the English chat line into ${language}. ` +
      `${levelBand(language, level)} ` +
      "This is the final display text: your entire reply must be only the translation. " +
      "Preserve the meaning of the English chat line. Do not answer the message, continue the conversation, or add new content. " +
      "Do not include the original English unless the requested language is English. " +
      "Do not add warnings, explanations, notes, quotes, labels, fact-checks, or policy language.",
  }
}

function repliesPrompt(language: string, level?: string): SafeRelayChatMessage {
  const prime = resolvePrime(language)
  return {
    role: "system",
    content:
      (prime ? `${prime} ` : "") +
      `Write two short, friendly replies in ${language}. ` +
      `${levelBand(language, level)} ` +
      "One reply per line. Output only the two replies. Keep them safe for young children. " +
      "No numbering, labels, notes, or explanations.",
  }
}

async function sampleSeeds(
  sampler: SafePhraseSampler | undefined,
  count: number,
  maxText: number,
): Promise<string[]> {
  if (!sampler) return []
  const seeds: string[] = []
  for (let i = 0; i < count * 2 && seeds.length < count; i += 1) {
    const phrase = usableModelText((await sampler("en").catch(() => "")) ?? "", maxText)
    if (phrase && !seeds.some((s) => sameish(s, phrase))) seeds.push(phrase)
  }
  return seeds
}

function pickSeed(seeds: string[], index: number): string {
  return seeds.length ? seeds[Math.abs(index) % seeds.length] : ""
}

function parseReplies(raw: string, maxText: number): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")
        .trim(),
    )
    .map((line) => usableModelText(line, Math.min(MAX_REPLY_TEXT, maxText)))
    .filter(Boolean)
    .slice(0, 3)
}

async function runPlainPass(
  runLlm: SafeRelayRunLlm,
  messages: SafeRelayChatMessage[],
  options: SafeRelayChatOptions,
  label: string,
  maxText: number,
): Promise<string> {
  const raw = await runLlm(messages, options, label).catch(() => "")
  return usableModelText(raw, maxText)
}

class RollingTextContext {
  private readonly byScope = new Map<string, string[]>()

  constructor(private readonly limit: number, private readonly maxText: number) {}

  add(scope: string, text: string): string[] {
    const raw = bounded(text, this.maxText)
    const next = [...(this.byScope.get(scope) ?? []), raw].filter(Boolean).slice(-this.limit)
    this.byScope.set(scope, next)
    return next
  }

  clear(): void {
    this.byScope.clear()
  }
}

async function sampleHostPhrase(host: SafePhraseHost, language: string): Promise<string | null> {
  const wanted = language || "en"
  const entries = host.getRandomEntries
    ? await host
        .getRandomEntries({ count: 8, languageCodes: [wanted, "en"], levels: ["A1", "A2"] })
        .catch(() => [])
    : host.getRandomEntry
      ? [await host.getRandomEntry().catch(() => null)]
      : []
  for (const entry of entries) {
    const translations = entry?.translations ?? []
    const exact = translations.find((t) => normalize(t.language_code) === normalize(wanted))
    const base = translations.find((t) => normalize(t.language_code).split("-")[0] === normalize(wanted).split("-")[0])
    const english = translations.find((t) => normalize(t.language_code).startsWith("en"))
    const text = exact?.text || base?.text || english?.text
    if (text) return text
  }
  return null
}

export function createHostSafePhraseSampler(host: SafePhraseHost): SafePhraseSampler {
  return (language) => sampleHostPhrase(host, language)
}

export function createSafeRelayPipeline(options: SafeRelayPipelineOptions) {
  const maxText = options.maxText ?? DEFAULT_MAX_TEXT
  const maxContext = options.maxContextMessages ?? DEFAULT_MAX_CONTEXT
  const rawContext = new RollingTextContext(maxContext, maxText)

  async function prepareOutbound(args: PrepareSafeRelayArgs): Promise<SafeRelayOutbound> {
    const raw = bounded(args.text, maxText)
    const seeds = await sampleSeeds(options.sampleSafePhrase, 3, maxText)
    if (!raw) {
      return {
        state: "replaced",
        relayText: pickSeed(seeds, 0) || (await fallbackPhrase("en", options.sampleSafePhrase, maxText)),
        reasons: ["empty-input"],
      }
    }

    const scope = args.scope || "default"
    const recent = args.recentRawMessages?.length
      ? args.recentRawMessages.map((m) => bounded(m, maxText)).filter(Boolean).slice(-maxContext)
      : rawContext.add(scope, raw)

    const reasons: string[] = []

    // 1. Normalize to plain English (model) — only when the source isn't English.
    let english = raw
    if (!isEnglish(args.sourceLanguage)) {
      const translated = await runPlainPass(
        options.runLlm,
        [
          normalizePrompt(args.sourceLanguage),
          {
            role: "user",
            content:
              "Recent local messages, private context only:\n" +
              `${formatContext(recent, maxText)}\n\n` +
              "Current message:\n" +
              raw,
          },
        ],
        { temperature: 0.15, topP: 0.8, maxTokens: 160 },
        "relay.normalize-english",
        maxText,
      )
      if (translated) {
        english = translated
        if (!sameish(translated, raw)) reasons.push("translated-to-english")
      } else {
        english = pickSeed(seeds, 1) || (await fallbackPhrase("en", options.sampleSafePhrase, maxText))
        reasons.push("translation-fallback")
      }
    }

    // 2. Deterministic scrub of obvious contact/identity/place material.
    const scrubbed = scrubText(english, maxText)
    if (!sameish(scrubbed, english)) reasons.push("scrubbed")
    let current = scrubbed
    const firstEnglish = current

    // 3. Risk-gated semantic cascade — clean lines skip straight to polish.
    const risky = riskProbe(english, scrubbed)
    if (risky) reasons.push("risk-escalated")
    let seedCursor = 0
    for (const pass of risky ? SEMANTIC_PASSES : []) {
      const next = await runPlainPass(
        options.runLlm,
        [driftPrompt(pass.focus), driftUser(recent, current, seeds, maxText)],
        { temperature: 0.45, topP: 0.85, maxTokens: 160 },
        `relay.${pass.label}`,
        maxText,
      )
      if (!next) {
        current = pickSeed(seeds, seedCursor++) || (await fallbackPhrase("en", options.sampleSafePhrase, maxText))
        reasons.push(`${pass.label}-fallback`)
      } else {
        if (!sameish(next, current)) reasons.push(pass.label)
        current = next
      }
    }

    // 4. Always-run creative polish: natural, a little interesting, never canned.
    const polished = await runPlainPass(
      options.runLlm,
      [driftPrompt(POLISH_FOCUS), driftUser(recent, current, seeds, maxText)],
      { temperature: 0.7, topP: 0.92, maxTokens: 160 },
      "relay.creative-polish",
      maxText,
    )
    if (polished) {
      if (!sameish(polished, current)) reasons.push("creative-polish")
      current = polished
    }

    // 5. Final guard → recompose-from-seed (model) → real corpus phrase. Never a dead canned line.
    let finalText = usableModelText(current, maxText)
    if (!finalText) {
      finalText = await recomposeFromSeed(seeds, seedCursor)
      reasons.push("recompose-fallback")
    }

    const changed = !sameish(finalText, firstEnglish) || reasons.some((reason) => reason.endsWith("fallback"))
    return {
      state: changed ? "replaced" : "send",
      relayText: finalText,
      reasons,
    }
  }

  async function recomposeFromSeed(seeds: string[], cursor: number): Promise<string> {
    const seed = pickSeed(seeds, cursor)
    if (!seed) return fallbackPhrase("en", options.sampleSafePhrase, maxText)
    const fresh = await runPlainPass(
      options.runLlm,
      [recomposeFromSeedPrompt(seed), { role: "user", content: "Write the line." }],
      { temperature: 0.8, topP: 0.95, maxTokens: 80 },
      "relay.recompose",
      maxText,
    )
    return fresh || seed
  }

  async function translateRelayText(
    relayText: string,
    language: string,
    role: "target" | "native",
    level?: string,
  ): Promise<string> {
    const cleanedLanguage = language || "en"
    return runPlainPass(
      options.runLlm,
      [translateOutPrompt(cleanedLanguage, level), { role: "user", content: relayText }],
      { temperature: 0.2, topP: 0.85, maxTokens: 180 },
      `relay.translate-${role}.${cleanedLanguage}`,
      maxText,
    )
  }

  async function lessonify(args: LessonifySafeRelayArgs): Promise<SafeRelayLesson> {
    const relay = bounded(args.relayText, maxText)
    const reasons: string[] = []
    const seeds = await sampleSeeds(options.sampleSafePhrase, 2, maxText)
    const incoming =
      usableModelText(relay, maxText) || pickSeed(seeds, 0) || (await fallbackPhrase("en", options.sampleSafePhrase, maxText))
    if (!sameish(incoming, relay)) reasons.push("incoming-fallback")

    // Independent recipient-side defense in depth: deterministic scrub, then a re-clean pass.
    const scrubbedIncoming = scrubText(incoming, maxText)
    const cleaned =
      (await runPlainPass(
        options.runLlm,
        [recleanPrompt(), { role: "user", content: scrubbedIncoming }],
        { temperature: 0.2, topP: 0.85, maxTokens: 160 },
        "relay.recipient-clean",
        maxText,
      )) || pickSeed(seeds, 1) || (await fallbackPhrase("en", options.sampleSafePhrase, maxText))
    if (!sameish(cleaned, incoming)) reasons.push("recipient-clean")

    let targetText = await translateRelayText(cleaned, args.targetLanguage, "target", args.level)
    if (!targetText) {
      targetText = await fallbackPhrase(args.targetLanguage, options.sampleSafePhrase, maxText)
      reasons.push("target-fallback")
    }

    let nativeText = await translateRelayText(cleaned, args.nativeLanguage, "native", args.level)
    if (!nativeText) {
      nativeText = await fallbackPhrase(args.nativeLanguage, options.sampleSafePhrase, maxText)
      reasons.push("native-fallback")
    }

    const repliesRaw = await options
      .runLlm(
        [repliesPrompt(args.targetLanguage, args.level), { role: "user", content: targetText }],
        { temperature: 0.45, topP: 0.9, maxTokens: 80 },
        `relay.replies.${args.targetLanguage}`,
      )
      .catch(() => "")
    const suggestedReplies = parseReplies(repliesRaw, maxText)

    return {
      state: reasons.length ? "replaced" : "send",
      relayText: cleaned,
      targetText,
      nativeText,
      suggestedReplies,
      reasons,
    }
  }

  return {
    prepareOutbound,
    lessonify,
    clear: () => rawContext.clear(),
  }
}
