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
        publishedAt: n.publishedAt,
        narrations: [],
        languages: [],
      }
      map.set(n.bookId, group)
    }
    group.narrations.push(n)
    if (!group.publishedAt && n.publishedAt) group.publishedAt = n.publishedAt
    if (!group.languages.includes(n.language)) {
      group.languages.push(n.language)
    }
  }

  // Sort books. Dated periodicals (e.g. "AI This Week") go newest-first; this
  // only kicks in between two dated books, so evergreen titles fall through to
  // the legacy order: narration count (desc), then volume, then title.
  return [...map.values()].sort((a, b) => {
    if (a.publishedAt && b.publishedAt && a.publishedAt !== b.publishedAt) {
      return a.publishedAt < b.publishedAt ? 1 : -1
    }
    if (a.narrations.length !== b.narrations.length) {
      return b.narrations.length - a.narrations.length
    }
    if ((a.volume ?? 0) !== (b.volume ?? 0)) {
      return (a.volume ?? 0) - (b.volume ?? 0)
    }
    return a.bookTitle.localeCompare(b.bookTitle)
  })
}

/**
 * Order books WITHIN a single series by explicit position. We honor `volume`
 * as the per-entry order field (a series index), so "Vol. 1, Vol. 2, Vol. 3…"
 * always reads in reading order rather than by narration-count. Books without
 * a volume fall back to publishedAt (oldest-first within a series — a series is
 * read front-to-back), then title. The input array order is the final
 * tiebreaker so the catalog's authored order is preserved.
 */
export function sortBooksWithinSeries(books: BookGroup[]): BookGroup[] {
  const indexed = books.map((b, i) => ({ b, i }))
  indexed.sort((x, y) => {
    const a = x.b
    const b = y.b
    const av = a.volume
    const bv = b.volume
    if (av != null && bv != null && av !== bv) return av - bv
    if (av != null && bv == null) return -1
    if (av == null && bv != null) return 1
    if (a.publishedAt && b.publishedAt && a.publishedAt !== b.publishedAt) {
      // Front-to-back within a series: earliest volume first.
      return a.publishedAt < b.publishedAt ? -1 : 1
    }
    const byTitle = a.bookTitle.localeCompare(b.bookTitle)
    if (byTitle !== 0) return byTitle
    return x.i - y.i
  })
  return indexed.map((t) => t.b)
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

  // Books within each series read in explicit (volume → date → title) order,
  // not the global narration-count order groupByBook handed us.
  for (const group of map.values()) {
    group.books = sortBooksWithinSeries(group.books)
  }

  return [...map.values()].sort((a, b) => {
    const ma = Math.max(...a.books.map((b) => b.narrations.length))
    const mb = Math.max(...b.books.map((b) => b.narrations.length))
    if (ma !== mb) return mb - ma
    return a.series.localeCompare(b.series)
  })
}

/** Sort dimension for the flat (compact) book list. */
export type BookSort = "latest" | "title" | "series"

/**
 * Flatten + sort books for the compact list view.
 *
 *   - "latest": newest `publishedAt` first; undated books sink below dated ones
 *     (a returning reader who has seen everything finds new additions fast).
 *   - "title":  alphabetical by book title.
 *   - "series": grouped by series in `groupBySeries` order, each series'
 *     books in explicit volume order — flattened. Lets the flat list still
 *     read series front-to-back when the user prefers that order.
 */
export function sortBooks(books: BookGroup[], sort: BookSort): BookGroup[] {
  if (sort === "title") {
    return [...books].sort((a, b) => a.bookTitle.localeCompare(b.bookTitle))
  }
  if (sort === "latest") {
    const indexed = books.map((b, i) => ({ b, i }))
    indexed.sort((x, y) => {
      const a = x.b.publishedAt
      const b = y.b.publishedAt
      if (a && b && a !== b) return a < b ? 1 : -1 // newest first
      if (a && !b) return -1
      if (!a && b) return 1
      return x.i - y.i
    })
    return indexed.map((t) => t.b)
  }
  // "series" — preserve groupBySeries ordering, flattened.
  const map = new Map<string, BookGroup[]>()
  for (const book of books) {
    const series = book.series || "Other"
    const list = map.get(series)
    if (list) list.push(book)
    else map.set(series, [book])
  }
  const seriesOrder = [...map.entries()].sort((a, b) => {
    const ma = Math.max(...a[1].map((bk) => bk.narrations.length))
    const mb = Math.max(...b[1].map((bk) => bk.narrations.length))
    if (ma !== mb) return mb - ma
    return a[0].localeCompare(b[0])
  })
  const out: BookGroup[] = []
  for (const [, list] of seriesOrder) {
    for (const bk of sortBooksWithinSeries(list)) out.push(bk)
  }
  return out
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
