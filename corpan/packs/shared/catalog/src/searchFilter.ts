import type {
  CatalogNarrationEntry,
  BookGroup,
  SeriesGroup,
  Character,
} from "./types"
import type { CatalogIndex } from "./catalogIndex"

/** Group narrations by book, collecting all language/voice variants */
export function groupByBook(narrations: CatalogNarrationEntry[]): BookGroup[] {
  const map = new Map<string, BookGroup>()

  for (const n of narrations) {
    let group = map.get(n.bookId)
    if (!group) {
      group = {
        bookId: n.bookId,
        bookTitle: n.bookTitle,
        series: n.series,
        volume: n.volume,
        narrations: [],
        languages: [],
      }
      map.set(n.bookId, group)
    }
    group.narrations.push(n)
    if (!group.languages.includes(n.language)) {
      group.languages.push(n.language)
    }
  }

  // Sort books by narration count (desc), then volume, then title
  return [...map.values()].sort((a, b) => {
    if (a.narrations.length !== b.narrations.length) {
      return b.narrations.length - a.narrations.length
    }
    if ((a.volume ?? 0) !== (b.volume ?? 0)) {
      return (a.volume ?? 0) - (b.volume ?? 0)
    }
    return a.bookTitle.localeCompare(b.bookTitle)
  })
}

/** Group books by series, ordered so the series with the most-narrated book floats up */
export function groupBySeries(narrations: CatalogNarrationEntry[]): SeriesGroup[] {
  const books = groupByBook(narrations)
  const map = new Map<string, SeriesGroup>()

  for (const book of books) {
    const series = book.series || "Other"
    let group = map.get(series)
    if (!group) {
      group = { series, books: [] }
      map.set(series, group)
    }
    group.books.push(book)
  }

  return [...map.values()].sort((a, b) => {
    const ma = Math.max(...a.books.map((b) => b.narrations.length))
    const mb = Math.max(...b.books.map((b) => b.narrations.length))
    if (ma !== mb) return mb - ma
    return a.series.localeCompare(b.series)
  })
}

/** Filter narrations by language (empty string = all) */
export function filterByLanguage(
  narrations: CatalogNarrationEntry[],
  lang: string
): CatalogNarrationEntry[] {
  if (!lang) return narrations
  return narrations.filter((n) => n.language === lang)
}

/** Search narrations by title (case-insensitive substring) */
export function searchByTitle(
  narrations: CatalogNarrationEntry[],
  query: string
): CatalogNarrationEntry[] {
  if (!query.trim()) return narrations
  const q = query.trim().toLowerCase()
  return narrations.filter(
    (n) =>
      n.bookTitle.toLowerCase().includes(q) ||
      (n.series?.toLowerCase().includes(q) ?? false)
  )
}

/** Filter narrations to those owned by a given character (joins via the catalog index). */
export function filterByCharacter(
  narrations: CatalogNarrationEntry[],
  characterId: string,
  index: CatalogIndex,
): CatalogNarrationEntry[] {
  if (!characterId) return narrations
  return narrations.filter((n) => index.getCharacterForNarration(n)?.id === characterId)
}

/** Search characters by displayName / tagline / bio / id (case-insensitive substring). */
export function searchCharacters(characters: Character[], query: string): Character[] {
  if (!query.trim()) return characters
  const q = query.trim().toLowerCase()
  return characters.filter(
    (c) =>
      c.displayName.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.tagline?.toLowerCase().includes(q) ?? false) ||
      (c.bio?.toLowerCase().includes(q) ?? false),
  )
}

/** Re-export of the index method for symmetry with other groupers in this file. */
export function groupByCharacter(
  narrations: CatalogNarrationEntry[],
  index: CatalogIndex,
) {
  return index.groupByCharacter(narrations)
}

/** Get unique languages from narrations list */
export function getAvailableLanguages(narrations: CatalogNarrationEntry[]): string[] {
  const set = new Set<string>()
  for (const n of narrations) set.add(n.language)
  return [...set].sort()
}

/**
 * Split a list of language codes into two ordered buckets:
 *   - `stack`:  languages also present in the user's stack, in the user's
 *               stack order (so "what I care about most" lands first).
 *   - `other`:  every remaining language from the input, alphabetized by
 *               display name for predictability.
 *
 * Pass `[]` for `stackLanguages` to skip prioritization — every language
 * lands in `other`. This is what readers do until the host wires up stack
 * config (or in dev with the mock host api before a stack is set).
 */
export function partitionLanguagesByStack(
  allLanguages: string[],
  stackLanguages: string[],
): { stack: string[]; other: string[] } {
  const available = new Set(allLanguages)
  const stack: string[] = []
  const seen = new Set<string>()
  for (const code of stackLanguages) {
    if (available.has(code) && !seen.has(code)) {
      stack.push(code)
      seen.add(code)
    }
  }
  const other = allLanguages
    .filter((code) => !seen.has(code))
    .sort((a, b) => getLanguageName(a).localeCompare(getLanguageName(b)))
  return { stack, other }
}

/**
 * Sort narrations stack-first. Stack-matched narrations come first in the
 * user's stack order; remaining narrations follow, sorted by language
 * display name. Stable within each language so the caller's prior order
 * (e.g. installed-first) is preserved.
 */
export function sortNarrationsByStack(
  narrations: CatalogNarrationEntry[],
  stackLanguages: string[],
): CatalogNarrationEntry[] {
  const stackRank = new Map<string, number>()
  stackLanguages.forEach((code, i) => {
    if (!stackRank.has(code)) stackRank.set(code, i)
  })
  const tagged = narrations.map((n, originalIndex) => ({
    n,
    originalIndex,
    inStack: stackRank.has(n.language),
    rank: stackRank.get(n.language) ?? Number.MAX_SAFE_INTEGER,
    displayName: getLanguageName(n.language),
  }))
  tagged.sort((a, b) => {
    if (a.inStack !== b.inStack) return a.inStack ? -1 : 1
    if (a.inStack && b.inStack) {
      if (a.rank !== b.rank) return a.rank - b.rank
      return a.originalIndex - b.originalIndex
    }
    const byName = a.displayName.localeCompare(b.displayName)
    if (byName !== 0) return byName
    return a.originalIndex - b.originalIndex
  })
  return tagged.map((t) => t.n)
}

/** Language display names — native name for each code. */
const LANG_NAMES: Record<string, string> = {
  en: "English",
  es: "Español",
  zh: "中文",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  ja: "日本語",
  ko: "한국어",
  ar: "العربية",
  hi: "हिन्दी",
  ru: "Русский",
  he: "עברית",
  tr: "Türkçe",
  nl: "Nederlands",
  pl: "Polski",
  sv: "Svenska",
  da: "Dansk",
  fi: "Suomi",
  uk: "Українська",
  el: "Ελληνικά",
  no: "Norsk",
  nb: "Norsk bokmål",
  nn: "Nynorsk",
  ms: "Bahasa Melayu",
  sw: "Kiswahili",
  id: "Bahasa Indonesia",
  th: "ไทย",
  vi: "Tiếng Việt",
  cs: "Čeština",
  hu: "Magyar",
  ro: "Română",
  bg: "Български",
  hr: "Hrvatski",
  sr: "Српски",
  sk: "Slovenčina",
  sl: "Slovenščina",
  fa: "فارسی",
  ur: "اردو",
  bn: "বাংলা",
  ta: "தமிழ்",
  te: "తెలుగు",
  ml: "മലയാളം",
  mr: "मराठी",
  gu: "ગુજરાતી",
  kn: "ಕನ್ನಡ",
  pa: "ਪੰਜਾਬੀ",
  si: "සිංහල",
  km: "ភាសាខ្មែរ",
  my: "မြန်မာ",
  tl: "Tagalog",
  am: "አማርኛ",
  ha: "Hausa",
  yo: "Yorùbá",
  zu: "isiZulu",
  af: "Afrikaans",
  ca: "Català",
  gl: "Galego",
  eu: "Euskara",
  is: "Íslenska",
  lt: "Lietuvių",
  lv: "Latviešu",
  et: "Eesti",
  mk: "Македонски",
  sq: "Shqip",
  az: "Azərbaycan",
  hy: "Հայերեն",
  ka: "ქართული",
  kk: "Қазақша",
  uz: "Oʻzbekcha",
  mn: "Монгол",
}

export function getLanguageName(code: string, catalogName?: string): string {
  return catalogName || LANG_NAMES[code] || code.toUpperCase()
}
