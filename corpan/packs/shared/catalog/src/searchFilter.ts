import type { CatalogNarrationEntry, BookGroup, SeriesGroup } from "./types"

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

  // Sort books by series then volume
  return [...map.values()].sort((a, b) => {
    const sa = a.series || ""
    const sb = b.series || ""
    if (sa !== sb) return sa.localeCompare(sb)
    return (a.volume ?? 0) - (b.volume ?? 0)
  })
}

/** Group books by series */
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

  return [...map.values()]
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

/** Get unique languages from narrations list */
export function getAvailableLanguages(narrations: CatalogNarrationEntry[]): string[] {
  const set = new Set<string>()
  for (const n of narrations) set.add(n.language)
  return [...set].sort()
}

/** Language display names */
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
}

export function getLanguageName(code: string, catalogName?: string): string {
  return catalogName || LANG_NAMES[code] || code.toUpperCase()
}
