import catalog from "@/data/book-catalog.json";

export interface BookChapter {
  number: number;
  title: string;
  segmentCount: number;
}

export interface Book {
  slug: string;
  id: string;
  title: string;
  author: string;
  series: string;
  volume: number | null;
  estimatedReadTime: string | null;
  estimatedListenTime: string | null;
  primaryLanguage: string;
  chapterCount: number;
  segmentCount: number;
  hasPreview: boolean;
  narrationLanguages: string[];
  chapters: BookChapter[];
}

export interface Series {
  slug: string;
  title: string;
  category: string;
  bookCount: number;
  books: Book[];
}

export interface BookCatalog {
  generatedAt: string;
  series: Series[];
}

export const bookCatalog = catalog as unknown as BookCatalog;

export function getSeries(seriesSlug: string): Series | undefined {
  return bookCatalog.series.find((s) => s.slug === seriesSlug);
}

export function getBook(
  seriesSlug: string,
  bookSlug: string
): { series: Series; book: Book } | undefined {
  const series = getSeries(seriesSlug);
  if (!series) return undefined;
  const book = series.books.find((b) => b.slug === bookSlug);
  if (!book) return undefined;
  return { series, book };
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  it: "Italiano",
  fr: "Français",
  de: "Deutsch",
  he: "עברית",
  ar: "العربية",
  ja: "日本語",
  ko: "한국어",
  zh: "中文",
  hi: "हिन्दी",
  ru: "Русский",
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] || code.toUpperCase();
}

const CATEGORY_LABELS: Record<string, string> = {
  sports: "Sports",
  history: "History",
  religion: "Religion",
  science: "Science",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}
