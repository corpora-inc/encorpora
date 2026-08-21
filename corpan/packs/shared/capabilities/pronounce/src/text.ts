// Script-aware comparison + pill tokenization — MOVED from
// packs/pronunciation-coach/src/game.ts (capability-modules.md §4.1).
// The pack re-exports these for its multiplayer mode; the capability's
// result view is the other consumer.
import type { SttWordTiming } from "@shared/capabilities/core"

// Whisper's word output is split on its tokenizer, which often breaks
// elided contractions like "j'ai", "qu'il", "don't", "I'll", "l'eau"
// into two separate "words". Merge those back together so the pills
// match how the language actually reads.
const APOSTROPHES_RE = /[''']/

// Per-language number-word → digit map. Mirrors the Swift table in
// the STT plugin so per-pill similarity agrees with the transcript-score
// similarity computed in the plugin: Whisper transcribes spoken numbers as
// digits ("90") regardless of how the speaker said them, so we map the
// EXPECTED word ("novanta") to its digit form before comparing.
const NUMBER_WORD_TO_DIGIT: Record<string, Record<string, string>> = {
  en: {
    zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
    six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11",
    twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15",
    sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19",
    twenty: "20", thirty: "30", forty: "40", fifty: "50", sixty: "60",
    seventy: "70", eighty: "80", ninety: "90", hundred: "100",
    thousand: "1000",
  },
  es: {
    cero: "0", uno: "1", una: "1", dos: "2", tres: "3", cuatro: "4",
    cinco: "5", seis: "6", siete: "7", ocho: "8", nueve: "9", diez: "10",
    once: "11", doce: "12", trece: "13", catorce: "14", quince: "15",
    dieciséis: "16", dieciseis: "16", diecisiete: "17", dieciocho: "18",
    diecinueve: "19", veinte: "20", treinta: "30", cuarenta: "40",
    cincuenta: "50", sesenta: "60", setenta: "70", ochenta: "80",
    noventa: "90", cien: "100", ciento: "100", mil: "1000",
  },
  fr: {
    zéro: "0", zero: "0", un: "1", une: "1", deux: "2", trois: "3",
    quatre: "4", cinq: "5", six: "6", sept: "7", huit: "8", neuf: "9",
    dix: "10", onze: "11", douze: "12", treize: "13", quatorze: "14",
    quinze: "15", seize: "16", vingt: "20", trente: "30", quarante: "40",
    cinquante: "50", soixante: "60", cent: "100", mille: "1000",
  },
  it: {
    zero: "0", uno: "1", una: "1", due: "2", tre: "3", quattro: "4",
    cinque: "5", sei: "6", sette: "7", otto: "8", nove: "9", dieci: "10",
    undici: "11", dodici: "12", tredici: "13", quattordici: "14",
    quindici: "15", sedici: "16", diciassette: "17", diciotto: "18",
    diciannove: "19", venti: "20", trenta: "30", quaranta: "40",
    cinquanta: "50", sessanta: "60", settanta: "70", ottanta: "80",
    novanta: "90", cento: "100", mille: "1000",
  },
  de: {
    null: "0", eins: "1", ein: "1", eine: "1", zwei: "2", drei: "3",
    vier: "4", fünf: "5", funf: "5", sechs: "6", sieben: "7", acht: "8",
    neun: "9", zehn: "10", elf: "11", zwölf: "12", zwolf: "12",
    dreizehn: "13", vierzehn: "14", fünfzehn: "15", funfzehn: "15",
    sechzehn: "16", siebzehn: "17", achtzehn: "18", neunzehn: "19",
    zwanzig: "20", dreißig: "30", dreissig: "30", vierzig: "40",
    fünfzig: "50", funfzig: "50", sechzig: "60", siebzig: "70",
    achtzig: "80", neunzig: "90", hundert: "100", tausend: "1000",
  },
  pt: {
    zero: "0", um: "1", uma: "1", dois: "2", duas: "2", três: "3",
    tres: "3", quatro: "4", cinco: "5", seis: "6", sete: "7", oito: "8",
    nove: "9", dez: "10", onze: "11", doze: "12", treze: "13",
    catorze: "14", quatorze: "14", quinze: "15", dezesseis: "16",
    dezasseis: "16", dezessete: "17", dezassete: "17", dezoito: "18",
    dezenove: "19", dezanove: "19", vinte: "20", trinta: "30",
    quarenta: "40", cinquenta: "50", sessenta: "60", setenta: "70",
    oitenta: "80", noventa: "90", cem: "100", cento: "100", mil: "1000",
  },
}

// Indic / Persian / Urdu BPE tokenizes phonemes into 2–4 sub-tokens, so
// even clean speech in these languages can legitimately push Whisper's
// `compressionRatio` past 2.4 — the default gibberish threshold. Mirrors
// the Swift `lowResourceLangs` set; used to suppress the "Sounded a bit
// garbled" chip on those langs.
export const LOW_RESOURCE_LANGS = new Set([
  "te", "ta", "bn", "ml", "mr", "gu", "pa", "ur", "fa", "si", "ne", "or", "as",
])

// RTL detection. Mirrors `RTL_LANGUAGES` in `corpan-app/src/store/constants.ts`
// — kept local so capabilities don't reach into the host. Full code wins
// (so `pa-Arab` is RTL but `pa-Guru` / `pa` are LTR); otherwise we fall
// back to the base language.
const RTL_BASE_LANGS = new Set(["ar", "he", "fa", "ur"])
const RTL_FULL_LANGS = new Set(["pa-arab"])
export const isRTL = (langCode: string): boolean => {
  if (!langCode) return false
  const c = langCode.toLowerCase()
  if (RTL_FULL_LANGS.has(c)) return true
  return RTL_BASE_LANGS.has(c.split("-")[0])
}

// Normalize for character-level word comparison: NFC, lowercase,
// strip punctuation / symbols / control / format characters, then
// (when a base language is known) map number-words to their digit
// form. Keeps every letter and combining mark (essential for Indic
// scripts).
export const normalizeForCompare = (s: string, lang?: string): string => {
  const base = s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\p{C}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!base) return base
  const baseLang = (lang ?? "")
    .toLowerCase()
    .split("-")[0]
  const dict = NUMBER_WORD_TO_DIGIT[baseLang]
  if (!dict) return base
  return base
    .split(" ")
    .map((w) => dict[w] ?? w)
    .join(" ")
}

// Per-grapheme splitting for scripts that don't use whitespace word
// boundaries. CJK (Chinese, Japanese kana / kanji, Korean Hangul
// syllable blocks) — every grapheme is a meaningful unit (a hanzi
// character, a kana, a Hangul block) so we render one pill per
// grapheme instead of one pill for the whole phrase. Tap-to-speak
// then works at the character level, which is what users want for
// drilling Mandarin / Cantonese.
//
// We deliberately don't extend this to Thai / Lao / Tibetan / Burmese:
// those use complex grapheme clusters where individual codepoints
// aren't independently meaningful, and a per-cluster split would need
// language-aware segmentation we don't have.
const CJK_RE =
  /[぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿가-힯]/
export const tokenizeForPills = (text: string): string[] => {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (/\s/.test(trimmed)) return trimmed.split(/\s+/).filter(Boolean)
  if (CJK_RE.test(trimmed)) {
    // Intl.Segmenter handles Hangul syllable composition and surrogate
    // pairs correctly; Array.from is a tolerable fallback if it's not
    // available (it isn't pre-iOS 16 / older WebViews — but iOS 17+
    // has it).
    type SegLike = { segment: string }
    const Seg = (
      Intl as unknown as {
        Segmenter?: new (l?: string, o?: { granularity: "grapheme" }) => {
          segment: (s: string) => Iterable<SegLike>
        }
      }
    ).Segmenter
    if (typeof Seg === "function") {
      const seg = new Seg(undefined, { granularity: "grapheme" })
      return Array.from(seg.segment(trimmed), (s) => s.segment).filter(
        (g) => g.trim().length > 0
      )
    }
    return Array.from(trimmed).filter((c) => c.trim().length > 0)
  }
  // Non-CJK without whitespace (single Latin word, etc.) — keep whole.
  return [trimmed]
}

// Codepoint-aware Levenshtein similarity in [0, 1].
export const charSimilarity = (a: string, b: string): number => {
  const an = Array.from(a)
  const bn = Array.from(b)
  const m = an.length
  const n = bn.length
  if (m === 0 && n === 0) return 1
  if (m === 0 || n === 0) return 0
  let prev = new Array<number>(n + 1)
  let curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] =
        an[i - 1] === bn[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    const tmp = prev
    prev = curr
    curr = tmp
  }
  return 1 - prev[n] / Math.max(m, n)
}

export const mergeApostropheWords = (
  words: SttWordTiming[]
): SttWordTiming[] => {
  if (!words || words.length === 0) return []
  const out: SttWordTiming[] = []
  for (const w of words) {
    const last = out[out.length - 1]
    if (last) {
      const lastChar = last.word.replace(/\s+$/, "").slice(-1)
      const firstChar = w.word.replace(/^\s+/, "").charAt(0)
      const prevEndsApos = APOSTROPHES_RE.test(lastChar)
      const curStartsApos = APOSTROPHES_RE.test(firstChar)
      if (prevEndsApos || curStartsApos) {
        last.word = last.word + w.word.replace(/^\s+/, "")
        last.endMs = Math.max(last.endMs, w.endMs)
        // Worst-token-wins: a contraction is only as confident as its
        // weakest tokenized fragment.
        last.probability = Math.min(last.probability, w.probability)
        continue
      }
    }
    out.push({ ...w })
  }
  return out
}

export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
