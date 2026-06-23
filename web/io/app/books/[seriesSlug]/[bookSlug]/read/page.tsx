import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  bookCatalog,
  getBook,
} from "@/lib/bookCatalog";
import { withBasePath } from "@/lib/basePath";
import { BookReader } from "@/components/BookReader";

interface PageProps {
  params: Promise<{ seriesSlug: string; bookSlug: string }>;
}

export function generateStaticParams() {
  const params: { seriesSlug: string; bookSlug: string }[] = [];
  for (const s of bookCatalog.series) {
    for (const b of s.books) {
      if (b.hasPreview) {
        params.push({ seriesSlug: s.slug, bookSlug: b.slug });
      }
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { seriesSlug, bookSlug } = await params;
  const found = getBook(seriesSlug, bookSlug);
  if (!found) return {};
  const { book, series } = found;
  const description = `Read Chapter 1 of ${book.title} — part of the ${series.title} series from Encorpora.`;
  return {
    title: `${book.title} — Preview — Encorpora`,
    description,
    openGraph: {
      title: `${book.title} — Preview`,
      description,
      type: "article",
    },
  };
}

function loadChapter(bookId: string) {
  const filePath = path.join(
    process.cwd(),
    "data",
    "segments",
    `${bookId}-ch1.json`
  );
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// RTL languages — used to set text direction on the reader
const RTL_LANGUAGES = new Set(["he", "ar", "fa", "ur"]);

export default async function ReaderPage({ params }: PageProps) {
  const { seriesSlug, bookSlug } = await params;
  const found = getBook(seriesSlug, bookSlug);
  if (!found) notFound();
  const { series, book } = found;
  if (!book.hasPreview) notFound();

  const chapter = loadChapter(book.id);
  if (!chapter) notFound();

  return (
    <BookReader
      chapter={chapter}
      bookHref={withBasePath(`/books/${series.slug}/${book.slug}/`)}
      bookTitle={book.title}
      seriesTitle={series.title}
      totalChapters={book.chapterCount}
      isRtl={RTL_LANGUAGES.has(book.primaryLanguage)}
    />
  );
}
