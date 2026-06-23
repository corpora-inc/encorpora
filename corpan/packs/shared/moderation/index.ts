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

// `query` lets the eject ask the corpus for a phrase that shares safe surface
// words with the user's line (production: FTS5 over the phrase packs) — so the
// relay is loosely connected and fun rather than a non-sequitur. Safe because the
// result is always a clean corpus phrase; unsafe query words simply don't match.
export type SafePhraseSampler = (language: string, query?: string) => Promise<string | null | undefined>

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
  // FTS5 lexical search over the phrase packs — used by the eject to pull a phrase
  // that shares safe words with the input. Optional: falls back to random when absent.
  searchEntries?: (
    q: { query: string; count: number; levels?: string[]; languageCodes?: string[] },
  ) => Promise<RandomEntry[]>
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

// CEFR band phrasing, authored IN each language so the (in-language) translation
// prompt stays entirely in the destination language. `en` is the seed/fallback;
// the rest are generated. Keys are base codes; resolved by exact then base code.
type LevelBands = { a: string; b: string; c: string }
const LEVEL_BANDS: Record<string, LevelBands> = {
  en: { a: "Use very simple, common words and short sentences.", b: "Use natural, everyday wording.", c: "Use rich, precise, eloquent wording." },
  es: { a: "Usa palabras muy sencillas y comunes y frases cortas.", b: "Usa un lenguaje natural y cotidiano.", c: "Usa un lenguaje rico, preciso y elocuente." },
  ar: { a: "استخدم كلمات بسيطة وشائعة جدًا وجملًا قصيرة.", b: "استخدم لغة طبيعية ويومية.", c: "استخدم لغة غنية ودقيقة وبليغة." },
  bg: { a: "Използвай много прости, обичайни думи и кратки изречения.", b: "Използвай естествен, всекидневен език.", c: "Използвай богат, точен и изразителен език." },
  bn: { a: "খুব সহজ, প্রচলিত শব্দ ও ছোট বাক্য ব্যবহার করুন।", b: "স্বাভাবিক, দৈনন্দিন ভাষা ব্যবহার করুন।", c: "সমৃদ্ধ, নির্ভুল ও প্রাঞ্জল ভাষা ব্যবহার করুন।" },
  ca: { a: "Fes servir paraules molt senzilles i comunes i frases curtes.", b: "Fes servir un llenguatge natural i quotidià.", c: "Fes servir un llenguatge ric, precís i eloqüent." },
  cs: { a: "Používej velmi jednoduchá, běžná slova a krátké věty.", b: "Používej přirozený, každodenní jazyk.", c: "Používej bohatý, přesný a výmluvný jazyk." },
  da: { a: "Brug meget enkle, almindelige ord og korte sætninger.", b: "Brug naturligt, hverdagsagtigt sprog.", c: "Brug et rigt, præcist og veltalende sprog." },
  de: { a: "Verwende sehr einfache, gängige Wörter und kurze Sätze.", b: "Verwende natürliche, alltägliche Formulierungen.", c: "Verwende eine reiche, präzise und gewandte Ausdrucksweise." },
  el: { a: "Χρησιμοποίησε πολύ απλές, κοινές λέξεις και σύντομες προτάσεις.", b: "Χρησιμοποίησε φυσική, καθημερινή διατύπωση.", c: "Χρησιμοποίησε πλούσια, ακριβή και εύγλωττη διατύπωση." },
  fa: { a: "از کلمات بسیار ساده و رایج و جمله‌های کوتاه استفاده کن.", b: "از زبان طبیعی و روزمره استفاده کن.", c: "از زبان غنی، دقیق و شیوا استفاده کن." },
  fi: { a: "Käytä hyvin yksinkertaisia, tavallisia sanoja ja lyhyitä lauseita.", b: "Käytä luonnollista, arkista kieltä.", c: "Käytä rikasta, täsmällistä ja sujuvaa kieltä." },
  fr: { a: "Utilise des mots très simples et courants et des phrases courtes.", b: "Utilise un langage naturel et quotidien.", c: "Utilise un langage riche, précis et éloquent." },
  gu: { a: "ખૂબ સરળ, સામાન્ય શબ્દો અને ટૂંકાં વાક્યો વાપરો.", b: "સ્વાભાવિક, રોજિંદી ભાષા વાપરો.", c: "સમૃદ્ધ, ચોક્કસ અને છટાદાર ભાષા વાપરો." },
  he: { a: "השתמש במילים פשוטות ונפוצות מאוד ובמשפטים קצרים.", b: "השתמש בשפה טבעית ויומיומית.", c: "השתמש בשפה עשירה, מדויקת ורהוטה." },
  hi: { a: "बहुत सरल, सामान्य शब्दों और छोटे वाक्यों का प्रयोग करें।", b: "स्वाभाविक, रोज़मर्रा की भाषा का प्रयोग करें।", c: "समृद्ध, सटीक और प्रवाहपूर्ण भाषा का प्रयोग करें।" },
  hr: { a: "Koristi vrlo jednostavne, uobičajene riječi i kratke rečenice.", b: "Koristi prirodan, svakodnevni jezik.", c: "Koristi bogat, precizan i rječit jezik." },
  hu: { a: "Használj nagyon egyszerű, gyakori szavakat és rövid mondatokat.", b: "Használj természetes, hétköznapi megfogalmazást.", c: "Használj gazdag, pontos és ékesszóló megfogalmazást." },
  id: { a: "Gunakan kata-kata yang sangat sederhana, umum, dan kalimat pendek.", b: "Gunakan ungkapan yang alami dan sehari-hari.", c: "Gunakan ungkapan yang kaya, tepat, dan fasih." },
  it: { a: "Usa parole molto semplici e comuni e frasi brevi.", b: "Usa un linguaggio naturale e quotidiano.", c: "Usa un linguaggio ricco, preciso ed eloquente." },
  ja: { a: "とても簡単でよく使う言葉と短い文を使ってください。", b: "自然で日常的な言い回しを使ってください。", c: "豊かで的確、流暢な言い回しを使ってください。" },
  kn: { a: "ತುಂಬಾ ಸರಳ, ಸಾಮಾನ್ಯ ಪದಗಳು ಮತ್ತು ಚಿಕ್ಕ ವಾಕ್ಯಗಳನ್ನು ಬಳಸಿ.", b: "ಸ್ವಾಭಾವಿಕ, ದೈನಂದಿನ ಭಾಷೆಯನ್ನು ಬಳಸಿ.", c: "ಸಮೃದ್ಧ, ನಿಖರ ಮತ್ತು ನಿರರ್ಗಳ ಭಾಷೆಯನ್ನು ಬಳಸಿ." },
  "ko-polite": { a: "아주 쉽고 흔한 단어와 짧은 문장을 사용하세요.", b: "자연스럽고 일상적인 표현을 사용하세요.", c: "풍부하고 정확하며 유려한 표현을 사용하세요." },
  ko: { a: "아주 쉽고 흔한 단어와 짧은 문장을 사용하세요.", b: "자연스럽고 일상적인 표현을 사용하세요.", c: "풍부하고 정확하며 유려한 표현을 사용하세요." },
  lt: { a: "Vartok labai paprastus, įprastus žodžius ir trumpus sakinius.", b: "Vartok natūralią, kasdienę kalbą.", c: "Vartok turtingą, tikslią ir iškalbingą kalbą." },
  mr: { a: "अतिशय सोपे, नेहमीचे शब्द आणि लहान वाक्ये वापरा.", b: "स्वाभाविक, रोजच्या भाषेचा वापर करा.", c: "समृद्ध, अचूक आणि ओघवती भाषा वापरा." },
  ms: { a: "Gunakan perkataan yang sangat mudah, biasa, dan ayat pendek.", b: "Gunakan bahasa yang semula jadi dan harian.", c: "Gunakan bahasa yang kaya, tepat, dan fasih." },
  ne: { a: "धेरै सरल, सामान्य शब्द र छोटा वाक्य प्रयोग गर्नुहोस्।", b: "स्वाभाविक, दैनिक भाषा प्रयोग गर्नुहोस्।", c: "समृद्ध, सटीक र प्रवाहमय भाषा प्रयोग गर्नुहोस्।" },
  nl: { a: "Gebruik heel eenvoudige, gangbare woorden en korte zinnen.", b: "Gebruik natuurlijke, alledaagse taal.", c: "Gebruik rijke, precieze en welsprekende taal." },
  no: { a: "Bruk svært enkle, vanlige ord og korte setninger.", b: "Bruk naturlig, hverdagslig språk.", c: "Bruk et rikt, presist og veltalende språk." },
  "pa-Arab": { a: "بہت سادہ، عام لفظ تے چھوٹے جملے ورتو۔", b: "قدرتی، روزمرہ دی بولی ورتو۔", c: "امیر، ٹھیک تے رواں بولی ورتو۔" },
  "pa-Guru": { a: "ਬਹੁਤ ਸਾਦੇ, ਆਮ ਸ਼ਬਦ ਅਤੇ ਛੋਟੇ ਵਾਕ ਵਰਤੋ।", b: "ਕੁਦਰਤੀ, ਰੋਜ਼ਮੱਰਾ ਦੀ ਭਾਸ਼ਾ ਵਰਤੋ।", c: "ਅਮੀਰ, ਸਟੀਕ ਅਤੇ ਰਵਾਂ ਭਾਸ਼ਾ ਵਰਤੋ।" },
  pl: { a: "Używaj bardzo prostych, powszechnych słów i krótkich zdań.", b: "Używaj naturalnego, codziennego języka.", c: "Używaj bogatego, precyzyjnego i wymownego języka." },
  "pt-BR": { a: "Use palavras muito simples e comuns e frases curtas.", b: "Use uma linguagem natural e do dia a dia.", c: "Use uma linguagem rica, precisa e eloquente." },
  "pt-PT": { a: "Usa palavras muito simples e comuns e frases curtas.", b: "Usa uma linguagem natural e do dia a dia.", c: "Usa uma linguagem rica, precisa e eloquente." },
  pt: { a: "Use palavras muito simples e comuns e frases curtas.", b: "Use uma linguagem natural e do dia a dia.", c: "Use uma linguagem rica, precisa e eloquente." },
  ro: { a: "Folosește cuvinte foarte simple, obișnuite și propoziții scurte.", b: "Folosește un limbaj natural, de zi cu zi.", c: "Folosește un limbaj bogat, precis și elocvent." },
  ru: { a: "Используй очень простые, частые слова и короткие предложения.", b: "Используй естественный, повседневный язык.", c: "Используй богатый, точный и выразительный язык." },
  sk: { a: "Používaj veľmi jednoduché, bežné slová a krátke vety.", b: "Používaj prirodzený, každodenný jazyk.", c: "Používaj bohatý, presný a výrečný jazyk." },
  sl: { a: "Uporabljaj zelo preproste, pogoste besede in kratke stavke.", b: "Uporabljaj naraven, vsakdanji jezik.", c: "Uporabljaj bogat, natančen in zgovoren jezik." },
  sr: { a: "Користи врло једноставне, уобичајене речи и кратке реченице.", b: "Користи природан, свакодневни језик.", c: "Користи богат, прецизан и речит језик." },
  sv: { a: "Använd mycket enkla, vanliga ord och korta meningar.", b: "Använd naturligt, vardagligt språk.", c: "Använd ett rikt, exakt och vältaligt språk." },
  sw: { a: "Tumia maneno rahisi sana, ya kawaida na sentensi fupi.", b: "Tumia lugha ya kawaida ya kila siku.", c: "Tumia lugha tajiri, sahihi na fasaha." },
  ta: { a: "மிக எளிய, பொதுவான சொற்களையும் குறுகிய வாக்கியங்களையும் பயன்படுத்துங்கள்.", b: "இயல்பான, அன்றாட மொழியைப் பயன்படுத்துங்கள்.", c: "செழுமையான, துல்லியமான, சொல்வளமுள்ள மொழியைப் பயன்படுத்துங்கள்." },
  te: { a: "చాలా సరళమైన, సాధారణ పదాలను మరియు చిన్న వాక్యాలను ఉపయోగించండి.", b: "సహజమైన, రోజువారీ భాషను ఉపయోగించండి.", c: "సంపన్నమైన, ఖచ్చితమైన, వాక్చాతుర్యం గల భాషను ఉపయోగించండి." },
  th: { a: "ใช้คำที่ง่ายและพบบ่อยมาก ๆ และประโยคสั้น ๆ", b: "ใช้ถ้อยคำที่เป็นธรรมชาติในชีวิตประจำวัน", c: "ใช้ถ้อยคำที่หลากหลาย แม่นยำ และสละสลวย" },
  tr: { a: "Çok basit, yaygın kelimeler ve kısa cümleler kullan.", b: "Doğal, günlük bir dil kullan.", c: "Zengin, kesin ve akıcı bir dil kullan." },
  uk: { a: "Використовуй дуже прості, поширені слова й короткі речення.", b: "Використовуй природну, повсякденну мову.", c: "Використовуй багату, точну й красномовну мову." },
  ur: { a: "بہت سادہ، عام الفاظ اور مختصر جملے استعمال کریں۔", b: "فطری، روزمرہ کی زبان استعمال کریں۔", c: "بھرپور، درست اور رواں زبان استعمال کریں۔" },
  vi: { a: "Dùng từ rất đơn giản, thông dụng và câu ngắn.", b: "Dùng cách diễn đạt tự nhiên, đời thường.", c: "Dùng cách diễn đạt phong phú, chính xác và trau chuốt." },
  "yue-Hant-HK": { a: "用好簡單、常見嘅字同短句。", b: "用自然、日常嘅講法。", c: "用豐富、精確、流暢嘅講法。" },
  "zh-Hans": { a: "使用非常简单常见的词语和短句。", b: "使用自然、日常的措辞。", c: "使用丰富、精准、流畅的措辞。" },
  "zh-Hant": { a: "使用非常簡單常見的詞語和短句。", b: "使用自然、日常的措辭。", c: "使用豐富、精準、流暢的措辭。" },
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
  es: "Traduce al español natural la línea en inglés que se te da. {level} Escribe solo la traducción: no respondas al mensaje ni sigas la conversación, y no añadas explicaciones, notas, comillas, etiquetas ni el texto original en inglés.",
  ar: "ترجم السطر الإنجليزي المعطى إلى عربية طبيعية. {level} اكتب الترجمة فقط: لا تردّ على الرسالة ولا تكمل المحادثة، ولا تضف شرحًا أو ملاحظات أو علامات اقتباس أو عناوين أو النص الإنجليزي الأصلي.",
  bg: "Преведи дадения английски ред на естествен български. {level} Напиши само превода: не отговаряй на съобщението и не продължавай разговора, и не добавяй обяснения, бележки, кавички, етикети или оригиналния английски текст.",
  bn: "দেওয়া ইংরেজি লাইনটি স্বাভাবিক বাংলায় অনুবাদ করুন। {level} শুধু অনুবাদটি লিখুন: বার্তার উত্তর দেবেন না বা কথোপকথন চালিয়ে যাবেন না, এবং কোনো ব্যাখ্যা, নোট, উদ্ধৃতিচিহ্ন, লেবেল বা মূল ইংরেজি লেখা যোগ করবেন না।",
  ca: "Tradueix al català natural la línia en anglès que se't dóna. {level} Escriu només la traducció: no responguis al missatge ni continuïs la conversa, i no afegeixis explicacions, notes, cometes, etiquetes ni el text original en anglès.",
  cs: "Přelož daný anglický řádek do přirozené češtiny. {level} Napiš pouze překlad: neodpovídej na zprávu ani nepokračuj v konverzaci a nepřidávej vysvětlení, poznámky, uvozovky, popisky ani původní anglický text.",
  da: "Oversæt den givne engelske linje til naturligt dansk. {level} Skriv kun oversættelsen: svar ikke på beskeden og fortsæt ikke samtalen, og tilføj ikke forklaringer, noter, anførselstegn, etiketter eller den oprindelige engelske tekst.",
  de: "Übersetze die vorgegebene englische Zeile in natürliches Deutsch. {level} Gib nur die Übersetzung aus: Antworte nicht auf die Nachricht und führe das Gespräch nicht fort, und füge keine Erklärungen, Notizen, Anführungszeichen, Beschriftungen oder den englischen Originaltext hinzu.",
  el: "Μετάφρασε τη δοσμένη αγγλική γραμμή σε φυσικά ελληνικά. {level} Γράψε μόνο τη μετάφραση: μην απαντάς στο μήνυμα και μη συνεχίζεις τη συνομιλία, και μην προσθέτεις εξηγήσεις, σημειώσεις, εισαγωγικά, ετικέτες ή το αρχικό αγγλικό κείμενο.",
  fa: "خط انگلیسی داده‌شده را به فارسی طبیعی ترجمه کن. {level} فقط ترجمه را بنویس: به پیام پاسخ نده و گفت‌وگو را ادامه نده، و هیچ توضیح، یادداشت، گیومه، برچسب یا متن اصلی انگلیسی اضافه نکن.",
  fi: "Käännä annettu englanninkielinen rivi luonnolliselle suomelle. {level} Kirjoita vain käännös: älä vastaa viestiin äläkä jatka keskustelua, äläkä lisää selityksiä, muistiinpanoja, lainausmerkkejä, otsikoita tai alkuperäistä englanninkielistä tekstiä.",
  fr: "Traduis en français naturel la ligne anglaise donnée. {level} Écris seulement la traduction : ne réponds pas au message et ne poursuis pas la conversation, et n'ajoute ni explication, ni note, ni guillemets, ni étiquette, ni le texte anglais d'origine.",
  gu: "આપેલી અંગ્રેજી લાઇનનો સ્વાભાવિક ગુજરાતીમાં અનુવાદ કરો. {level} ફક્ત અનુવાદ લખો: સંદેશનો જવાબ ન આપો કે વાતચીત આગળ ન વધારો, અને કોઈ સમજૂતી, નોંધ, અવતરણચિહ્ન, લેબલ કે મૂળ અંગ્રેજી લખાણ ઉમેરશો નહીં.",
  he: "תרגם את השורה האנגלית הנתונה לעברית טבעית. {level} כתוב רק את התרגום: אל תענה להודעה ואל תמשיך את השיחה, ואל תוסיף הסברים, הערות, מירכאות, תוויות או את הטקסט האנגלי המקורי.",
  hi: "दी गई अंग्रेज़ी पंक्ति का स्वाभाविक हिंदी में अनुवाद करें। {level} केवल अनुवाद लिखें: संदेश का उत्तर न दें और बातचीत आगे न बढ़ाएँ, तथा कोई व्याख्या, टिप्पणी, उद्धरण-चिह्न, लेबल या मूल अंग्रेज़ी पाठ न जोड़ें।",
  hr: "Prevedi zadani engleski redak na prirodni hrvatski. {level} Napiši samo prijevod: nemoj odgovarati na poruku ni nastavljati razgovor i nemoj dodavati objašnjenja, bilješke, navodnike, oznake ni izvorni engleski tekst.",
  hu: "Fordítsd le a megadott angol sort természetes magyarra. {level} Csak a fordítást írd le: ne válaszolj az üzenetre és ne folytasd a beszélgetést, és ne adj hozzá magyarázatot, jegyzetet, idézőjelet, címkét vagy az eredeti angol szöveget.",
  id: "Terjemahkan baris bahasa Inggris yang diberikan ke bahasa Indonesia yang alami. {level} Tulis hanya terjemahannya: jangan menjawab pesan atau melanjutkan percakapan, dan jangan menambahkan penjelasan, catatan, tanda kutip, label, atau teks bahasa Inggris aslinya.",
  it: "Traduci in italiano naturale la riga inglese fornita. {level} Scrivi solo la traduzione: non rispondere al messaggio né continuare la conversazione, e non aggiungere spiegazioni, note, virgolette, etichette o il testo inglese originale.",
  ja: "与えられた英語の文を自然な日本語に翻訳してください。{level} 訳文だけを書いてください。メッセージに返答したり会話を続けたりせず、説明・注釈・引用符・ラベル・元の英文を加えないでください。",
  kn: "ನೀಡಿರುವ ಇಂಗ್ಲಿಷ್ ಸಾಲನ್ನು ಸ್ವಾಭಾವಿಕ ಕನ್ನಡಕ್ಕೆ ಅನುವಾದಿಸಿ. {level} ಅನುವಾದವನ್ನು ಮಾತ್ರ ಬರೆಯಿರಿ: ಸಂದೇಶಕ್ಕೆ ಉತ್ತರಿಸಬೇಡಿ ಅಥವಾ ಸಂಭಾಷಣೆಯನ್ನು ಮುಂದುವರಿಸಬೇಡಿ, ಮತ್ತು ಯಾವುದೇ ವಿವರಣೆ, ಟಿಪ್ಪಣಿ, ಉದ್ಧರಣ ಚಿಹ್ನೆ, ಲೇಬಲ್ ಅಥವಾ ಮೂಲ ಇಂಗ್ಲಿಷ್ ಪಠ್ಯವನ್ನು ಸೇರಿಸಬೇಡಿ.",
  "ko-polite": "주어진 영어 문장을 자연스럽고 공손한 한국어로 번역하세요. {level} 번역문만 쓰세요. 메시지에 답하거나 대화를 이어가지 말고, 설명, 메모, 따옴표, 라벨, 원본 영어 문장을 덧붙이지 마세요.",
  ko: "주어진 영어 문장을 자연스럽고 공손한 한국어로 번역하세요. {level} 번역문만 쓰세요. 메시지에 답하거나 대화를 이어가지 말고, 설명, 메모, 따옴표, 라벨, 원본 영어 문장을 덧붙이지 마세요.",
  lt: "Išversk pateiktą anglišką eilutę į natūralią lietuvių kalbą. {level} Rašyk tik vertimą: neatsakyk į žinutę ir netęsk pokalbio, taip pat nepridėk paaiškinimų, pastabų, kabučių, etikečių ar originalaus angliško teksto.",
  mr: "दिलेल्या इंग्रजी ओळीचा स्वाभाविक मराठीत अनुवाद करा. {level} फक्त अनुवाद लिहा: संदेशाला उत्तर देऊ नका किंवा संभाषण पुढे चालवू नका, आणि कोणतेही स्पष्टीकरण, टीप, अवतरणचिन्ह, लेबल किंवा मूळ इंग्रजी मजकूर जोडू नका.",
  ms: "Terjemahkan baris bahasa Inggeris yang diberikan ke bahasa Melayu yang semula jadi. {level} Tulis terjemahan sahaja: jangan jawab mesej atau teruskan perbualan, dan jangan tambah penjelasan, nota, tanda petik, label atau teks bahasa Inggeris asal.",
  ne: "दिइएको अङ्ग्रेजी हरफलाई स्वाभाविक नेपालीमा अनुवाद गर्नुहोस्। {level} अनुवाद मात्र लेख्नुहोस्: सन्देशको जवाफ नदिनुहोस् वा कुराकानी अगाडि नबढाउनुहोस्, र कुनै व्याख्या, टिप्पणी, उद्धरण-चिन्ह, लेबल वा मूल अङ्ग्रेजी पाठ नथप्नुहोस्।",
  nl: "Vertaal de gegeven Engelse regel naar natuurlijk Nederlands. {level} Schrijf alleen de vertaling: beantwoord het bericht niet en zet het gesprek niet voort, en voeg geen uitleg, notities, aanhalingstekens, labels of de oorspronkelijke Engelse tekst toe.",
  no: "Oversett den gitte engelske linjen til naturlig norsk. {level} Skriv bare oversettelsen: ikke svar på meldingen og ikke fortsett samtalen, og ikke legg til forklaringer, notater, anførselstegn, etiketter eller den opprinnelige engelske teksten.",
  "pa-Arab": "دتی گئی انگریزی لائن دا قدرتی پنجابی شاہمکھی وچ ترجمہ کرو۔ {level} صرف ترجمہ لکھو: پیغام دا جواب نہ دیو تے گل بات اگے نہ ودھاؤ، تے کوئی وضاحت، نوٹ، واوین، لیبل یا اصل انگریزی متن شامل نہ کرو۔",
  "pa-Guru": "ਦਿੱਤੀ ਗਈ ਅੰਗਰੇਜ਼ੀ ਲਾਈਨ ਦਾ ਕੁਦਰਤੀ ਪੰਜਾਬੀ ਗੁਰਮੁਖੀ ਵਿੱਚ ਅਨੁਵਾਦ ਕਰੋ। {level} ਸਿਰਫ਼ ਅਨੁਵਾਦ ਲਿਖੋ: ਸੁਨੇਹੇ ਦਾ ਜਵਾਬ ਨਾ ਦਿਓ ਜਾਂ ਗੱਲਬਾਤ ਅੱਗੇ ਨਾ ਵਧਾਓ, ਅਤੇ ਕੋਈ ਵਿਆਖਿਆ, ਨੋਟ, ਹਵਾਲਾ-ਚਿੰਨ੍ਹ, ਲੇਬਲ ਜਾਂ ਅਸਲ ਅੰਗਰੇਜ਼ੀ ਲਿਖਤ ਨਾ ਜੋੜੋ।",
  pl: "Przetłumacz podaną angielską linijkę na naturalną polszczyznę. {level} Napisz tylko tłumaczenie: nie odpowiadaj na wiadomość ani nie kontynuuj rozmowy i nie dodawaj wyjaśnień, notatek, cudzysłowów, etykiet ani oryginalnego angielskiego tekstu.",
  "pt-BR": "Traduza para o português brasileiro natural a linha em inglês fornecida. {level} Escreva apenas a tradução: não responda à mensagem nem continue a conversa, e não acrescente explicações, notas, aspas, rótulos ou o texto original em inglês.",
  "pt-PT": "Traduz para português europeu natural a linha em inglês fornecida. {level} Escreve apenas a tradução: não respondas à mensagem nem continues a conversa, e não acrescentes explicações, notas, aspas, etiquetas ou o texto original em inglês.",
  pt: "Traduza para o português natural a linha em inglês fornecida. {level} Escreva apenas a tradução: não responda à mensagem nem continue a conversa, e não acrescente explicações, notas, aspas, rótulos ou o texto original em inglês.",
  ro: "Tradu în română naturală linia în engleză dată. {level} Scrie doar traducerea: nu răspunde la mesaj și nu continua conversația și nu adăuga explicații, note, ghilimele, etichete sau textul original în engleză.",
  ru: "Переведи данную английскую строку на естественный русский. {level} Напиши только перевод: не отвечай на сообщение и не продолжай разговор, не добавляй объяснений, заметок, кавычек, ярлыков или исходный английский текст.",
  sk: "Prelož daný anglický riadok do prirodzenej slovenčiny. {level} Napíš iba preklad: neodpovedaj na správu ani nepokračuj v konverzácii a nepridávaj vysvetlenia, poznámky, úvodzovky, štítky ani pôvodný anglický text.",
  sl: "Prevedi dano angleško vrstico v naravno slovenščino. {level} Napiši samo prevod: ne odgovarjaj na sporočilo in ne nadaljuj pogovora ter ne dodajaj razlag, opomb, narekovajev, oznak ali izvirnega angleškega besedila.",
  sr: "Преведи дати енглески ред на природни српски. {level} Напиши само превод: не одговарај на поруку нити настављај разговор и не додај објашњења, белешке, наводнике, ознаке нити изворни енглески текст.",
  sv: "Översätt den givna engelska raden till naturlig svenska. {level} Skriv bara översättningen: svara inte på meddelandet och fortsätt inte samtalet, och lägg inte till förklaringar, anteckningar, citattecken, etiketter eller den ursprungliga engelska texten.",
  sw: "Tafsiri mstari uliotolewa wa Kiingereza kwa Kiswahili cha kawaida. {level} Andika tafsiri tu: usijibu ujumbe wala usiendeleze mazungumzo, na usiongeze maelezo, vidokezo, alama za nukuu, lebo au maandishi ya awali ya Kiingereza.",
  ta: "கொடுக்கப்பட்ட ஆங்கில வரியை இயல்பான தமிழில் மொழிபெயர்க்கவும். {level} மொழிபெயர்ப்பை மட்டும் எழுதவும்: செய்திக்குப் பதிலளிக்காதீர்கள் அல்லது உரையாடலைத் தொடராதீர்கள், மேலும் எந்த விளக்கம், குறிப்பு, மேற்கோள் குறி, பெயரிடல் அல்லது மூல ஆங்கில உரையைச் சேர்க்காதீர்கள்.",
  te: "ఇచ్చిన ఆంగ్ల పంక్తిని సహజమైన తెలుగులోకి అనువదించండి. {level} అనువాదాన్ని మాత్రమే రాయండి: సందేశానికి సమాధానం ఇవ్వకండి లేదా సంభాషణను కొనసాగించకండి, మరియు ఎలాంటి వివరణ, గమనిక, కొటేషన్ గుర్తులు, లేబుల్ లేదా అసలు ఆంగ్ల పాఠాన్ని జోడించకండి.",
  th: "แปลบรรทัดภาษาอังกฤษที่ให้มาเป็นภาษาไทยที่เป็นธรรมชาติ {level} เขียนเฉพาะคำแปลเท่านั้น อย่าตอบข้อความหรือสนทนาต่อ และอย่าเพิ่มคำอธิบาย หมายเหตุ เครื่องหมายคำพูด ป้ายกำกับ หรือข้อความภาษาอังกฤษต้นฉบับ",
  tr: "Verilen İngilizce satırı doğal Türkçeye çevir. {level} Yalnızca çeviriyi yaz: mesajı yanıtlama ya da konuşmayı sürdürme, ve açıklama, not, tırnak işareti, etiket veya özgün İngilizce metni ekleme.",
  uk: "Переклади дану англійську стрічку природною українською. {level} Напиши лише переклад: не відповідай на повідомлення й не продовжуй розмову, і не додавай пояснень, нотаток, лапок, міток чи оригінальний англійський текст.",
  ur: "دی گئی انگریزی سطر کا فطری اردو میں ترجمہ کریں۔ {level} صرف ترجمہ لکھیں: پیغام کا جواب نہ دیں اور نہ گفتگو جاری رکھیں، اور کوئی وضاحت، نوٹ، واوین، لیبل یا اصل انگریزی متن شامل نہ کریں۔",
  vi: "Dịch dòng tiếng Anh đã cho sang tiếng Việt tự nhiên. {level} Chỉ viết bản dịch: đừng trả lời tin nhắn hay tiếp tục cuộc trò chuyện, và đừng thêm lời giải thích, ghi chú, dấu ngoặc kép, nhãn hay văn bản tiếng Anh gốc.",
  "yue-Hant-HK": "將畀你嘅英文句子翻譯成自然嘅廣東話繁體中文。{level} 淨係寫譯文：唔好回覆訊息或者繼續對話，亦都唔好加任何解釋、註腳、引號、標籤或者原本嘅英文。",
  "zh-Hans": "把给定的英文句子翻译成自然的简体中文。{level} 只写译文：不要回复消息或继续对话，也不要添加任何解释、批注、引号、标签或原始英文。",
  "zh-Hant": "把給定的英文句子翻譯成自然的繁體中文。{level} 只寫譯文：不要回覆訊息或繼續對話，也不要加入任何解釋、註腳、引號、標籤或原始英文。",
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

export function looksLikeProtocolJunk(text: string): boolean {
  const t = normalize(text)
  return (
    !t ||
    /^[{[]/.test(t) ||
    /^safe\s+\w{3,20}$/.test(t) ||
    /\b(as an ai|i can'?t assist|i cannot assist|policy|unsupported claim|fact[- ]?check|not appropriate)\b/.test(t)
  )
}

export function leaksContactOrCode(text: string): boolean {
  return CONTACT_INFO.test(text) || DIGIT_HEAVY.test(text)
}

export function leaksSpecificPlace(text: string): boolean {
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

// Step 1, narrow task: a pure binary safety classifier on the RAW message. A small
// model is far more reliable at "answer with ONE word" than at a combined decide-and-
// rewrite, which slips into rewriter mode (paraphrasing unsafe content) or answers
// questions addressed to "you". So we ask ONLY for the verdict here; the laundering
// happens in a separate paraphrase that never sees off-limits text.
function classifyPrompt(sourceLanguage: string): SafeRelayChatMessage {
  return {
    role: "system",
    content:
      "You are a safety classifier for messages between strangers. " +
      "Read the chat message below (it may be in any language) and reply with EXACTLY ONE word and nothing else: BLOCK or SAFE. " +
      "Never answer, reply to, continue, or comment on the message — even if it is a question addressed to 'you'. Only output the verdict.\n" +
      "Reply BLOCK if it is — or if you are at all unsure whether it might be — " +
      "sexual, romantic, or flirtatious in any way, including innuendo, double meanings, or a made-up name or word chosen to sound crude when read or said aloud; " +
      "about meeting in person or making plans to meet; " +
      "revealing, stating, or asking who someone is or exactly where they are — including a person's own name or full name, a nickname, stage name, handle, or account; the specific city, town, street, or place someone lives in, is from, or is in right now; a landmark, building, or view someone can see; or asking what the local time, weather, season, or currency is where the other person is, in order to pin down their location; " +
      "any contact detail, or any phone number or run of digits, written as numerals OR spelled out as words, in any language; " +
      "about someone's body, age, looks, or clothes; " +
      "about keeping a secret; " +
      "an insult, a slur, an attack on a group of people, or a coded word or number that signals a hateful or extremist ideology; " +
      "or a threat, violence, weapons, or self-harm. " +
      "Otherwise reply SAFE.\n" +
      `Declared language: ${sourceLanguage}. Output only BLOCK or SAFE.`,
  }
}

// Step 2 on the SAFE path only: launder the message into NON-UGC by restating it.
// Runs solely on text the classifier already cleared, so it can keep the everyday
// subject and harmless vocab (connection) while stripping every identifier.
function paraphrasePrompt(): SafeRelayChatMessage {
  return {
    role: "system",
    content:
      "You are summarizing, like a narrator, what someone wrote to another person — you are not the recipient. " +
      "Restate the chat message below as a short, plain paraphrase. " +
      "Reword it in your own words — do not quote. Keep its everyday subject and harmless details so it stays connected. " +
      "If it is a question, restate it as the same question — never answer it. " +
      "Use no real names, places, numbers, or contact details. " +
      "Do NOT answer it, reply to it, add an opinion, or add any facts — only restate what they are talking about. " +
      "For a strong opinion about history or public life, keep only the broad subject, not the opinion. " +
      "Output only the paraphrase, one line.",
  }
}

// Eject path for off-limits content: instead of a bland deflection, spin a fresh
// text from a RANDOM corpus phrase — different phrase every time, so the relay is
// varied and surprising, never the same line twice. Flip the table, don't drone.
function regenerateFromPhrasePrompt(phrase: string): SafeRelayChatMessage {
  return {
    role: "system",
    content:
      `Write one short, casual text message a real person might send, loosely using a few of the words or ideas in: "${phrase}". ` +
      "Keep it first person and a little unexpected, under about fourteen words. " +
      "No emoji, no greeting, not a question, not an assistant voice. Mention no real person, place, or contact detail. " +
      "Output only the message.",
  }
}

// Step 2. Write a brand-new line from ONLY the abstract topic — never the user's
// original text. This is what makes the relay non-UGC.
function regeneratePrompt(form: "question" | "statement"): SafeRelayChatMessage {
  const shape =
    form === "question"
      ? "Keep it a question, the kind a friend would actually text — not a quiz, fact-check, or 'why' question."
      : "Keep it a plain, everyday remark — even a little mundane is fine."
  return {
    role: "system",
    content:
      "You are a regular person texting a friend — not an assistant, teacher, or expert. " +
      "Rephrase the line below into ONE short, casual text in your own words: keep its subject and any harmless details so it stays connected, just make it sound like a normal text. " +
      shape +
      " Never explain, define, give facts or advice, or sound knowledgeable. One short sentence. No emoji, no greeting. " +
      "Never include names, places, numbers, contact details, or anything about meeting in person, where someone is, or someone's body, age, or clothes. " +
      "Output only the text.",
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

// Build a safe FTS5 MATCH query from a raw line: keep only word characters, drop
// 1–2 char noise, OR the terms. Unsafe tokens simply won't match the clean corpus.
function ftsQuery(raw: string): string {
  const terms = (normalize(raw).match(/[\p{L}\p{N}]{3,}/gu) ?? []).slice(0, 8)
  return [...new Set(terms)].join(" OR ")
}

async function sampleHostPhrase(host: SafePhraseHost, language: string, query?: string): Promise<string | null> {
  const wanted = language || "en"
  const match = query ? ftsQuery(query) : ""
  const entries =
    match && host.searchEntries
      ? await host.searchEntries({ query: match, count: 8, languageCodes: [wanted, "en"], levels: ["A1", "A2"] }).catch(() => [])
      : host.getRandomEntries
        ? await host.getRandomEntries({ count: 8, languageCodes: [wanted, "en"], levels: ["A1", "A2"] }).catch(() => [])
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
  // Uses host.searchEntries (FTS5) when present so the eject pulls a phrase sharing
  // safe words with the input; otherwise falls back to a random safe phrase.
  return (language, query) => sampleHostPhrase(host, language, query)
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

    const reasons: string[] = []

    // Transform UGC into NON-UGC in two narrow steps. (1) A binary classifier
    // decides BLOCK vs SAFE — one small clear task the 4B does reliably, and it
    // never answers or rewrites. (2a) BLOCK → obliterate via a corpus remix; the
    // off-limits text is never restated. (2b) SAFE → paraphrase (launder, keep
    // subject) → regenerate (naturalize). The relay is never the user's own words,
    // so names, places, contact info, and hidden jokes cannot survive. No wordlists,
    // no examples in the prompts.

    // 1. Classify the RAW message → BLOCK (off-limits) or SAFE.
    const verdict = await runPlainPass(
      options.runLlm,
      [classifyPrompt(args.sourceLanguage), { role: "user", content: raw }],
      { temperature: 0, topP: 0.8, maxTokens: 4 },
      "relay.classify",
      maxText,
    )

    // Fail safe: anything that isn't a clear SAFE is treated as off-limits.
    const offLimits = !/\bsafe\b/i.test(verdict) || /\bblock\b/i.test(verdict)
    let current: string
    if (offLimits) {
      // FLIP THE TABLE: regenerate from a corpus phrase that shares safe words with
      // the input (loosely connected, fun, never the same twice). The raw off-limits
      // text is never paraphrased — only its safe surface words can match the corpus.
      const phrase =
        (await options.sampleSafePhrase?.("en", raw).catch(() => "")) ||
        pickSeed(seeds, 0) ||
        (await fallbackPhrase("en", options.sampleSafePhrase, maxText))
      current = await runPlainPass(
        options.runLlm,
        [regenerateFromPhrasePrompt(phrase), { role: "user", content: "Write the message." }],
        { temperature: 0.85, topP: 0.95, maxTokens: 80 },
        "relay.phrase-eject",
        maxText,
      )
      reasons.push("phrase-eject")
    } else {
      // 2. Launder the cleared message into NON-UGC, then naturalize it. The
      // paraphrase only ever runs on classifier-cleared text and strips every
      // identifier while keeping the everyday subject (connection).
      const paraphrase = await runPlainPass(
        options.runLlm,
        [paraphrasePrompt(), { role: "user", content: raw }],
        { temperature: 0.3, topP: 0.85, maxTokens: 64 },
        "relay.paraphrase",
        maxText,
      )
      // FIREWALL: regenerate only ever sees the laundered paraphrase, NEVER the raw
      // message. If the paraphrase failed (empty/junk), leave `current` empty so the
      // corpus-seed fallback (step 4) takes over — we must never feed raw UGC forward.
      if (paraphrase) {
        // Preserve modality: a question stays a question, a statement stays a
        // statement — so the relay never fabricates an answer the sender didn't give.
        const form = /\?\s*$/.test(raw.trim()) ? "question" : "statement"
        current = await runPlainPass(
          options.runLlm,
          [regeneratePrompt(form), { role: "user", content: paraphrase }],
          { temperature: 0.5, topP: 0.9, maxTokens: 64 },
          "relay.regenerate",
          maxText,
        )
      } else {
        current = ""
        reasons.push("paraphrase-failed")
      }
    }

    // 3. Deterministic scrub backstop (the regenerated line should already be clean).
    if (current) {
      const scrubbed = scrubText(current, maxText)
      if (!sameish(scrubbed, current)) reasons.push("scrubbed")
      current = scrubbed
    }

    // 4. Guard → recompose-from-seed → corpus phrase. Never echo, never a dead canned line.
    let finalText = usableModelText(current, maxText)
    if (!finalText) {
      finalText = await recomposeFromSeed(seeds, 0)
      reasons.push("regenerate-fallback")
    }

    // An eject (off-limits) or any fallback is a hard replacement; an on-topic
    // regenerate of benign content is reported as a clean send.
    const replaced = reasons.includes("phrase-eject") || reasons.some((reason) => reason.endsWith("fallback"))
    return {
      state: replaced ? "replaced" : "send",
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
