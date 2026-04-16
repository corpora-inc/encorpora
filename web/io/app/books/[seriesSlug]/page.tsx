import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  bookCatalog,
  categoryLabel,
  getSeries,
  languageName,
} from "@/lib/bookCatalog";
import { withBasePath } from "@/lib/basePath";

interface PageProps {
  params: Promise<{ seriesSlug: string }>;
}

export function generateStaticParams() {
  return bookCatalog.series.map((s) => ({ seriesSlug: s.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { seriesSlug } = await params;
  const series = getSeries(seriesSlug);
  if (!series) return {};
  return {
    title: `${series.title} — Encorpora`,
    description: `${series.bookCount} books in the ${series.title} series. Free narrations for the Corpan reader packs.`,
  };
}

export default async function SeriesPage({ params }: PageProps) {
  const { seriesSlug } = await params;
  const series = getSeries(seriesSlug);
  if (!series) notFound();

  return (
    <div className="px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-8">
          <Link
            href={withBasePath("/books/")}
            className="hover:text-black transition-colors"
          >
            Books
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{series.title}</span>
        </nav>

        {/* Series header */}
        <header className="mb-16">
          <span className="inline-block text-xs uppercase tracking-wider font-medium text-gray-400 mb-3">
            {categoryLabel(series.category)}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-3">
            {series.title}
          </h1>
          <p className="text-gray-600">
            {series.bookCount} {series.bookCount === 1 ? "book" : "books"} in
            this series
          </p>
        </header>

        {/* Books grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {series.books.map((book) => (
            <Link
              key={book.slug}
              href={withBasePath(`/books/${series.slug}/${book.slug}/`)}
              className="group block bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <div className="flex items-center justify-between mb-3 text-xs text-gray-400">
                {book.volume != null ? (
                  <span className="uppercase tracking-wider font-medium">
                    Volume {book.volume}
                  </span>
                ) : (
                  <span />
                )}
                {book.hasPreview && (
                  <span className="uppercase tracking-wider font-medium text-gray-500">
                    Preview available
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-black transition-colors leading-snug">
                {book.title}
              </h2>
              <p className="text-sm text-gray-500 mb-4">by {book.author}</p>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-4">
                {book.estimatedReadTime && (
                  <span>Read {book.estimatedReadTime}</span>
                )}
                {book.estimatedListenTime && (
                  <span>Listen {book.estimatedListenTime}</span>
                )}
                {book.chapterCount > 0 && (
                  <span>
                    {book.chapterCount}{" "}
                    {book.chapterCount === 1 ? "chapter" : "chapters"}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {book.narrationLanguages.map((lang) => (
                  <span
                    key={lang}
                    className="text-xs px-2 py-0.5 bg-gray-50 text-gray-600 rounded border border-gray-100"
                    title={languageName(lang)}
                  >
                    {lang.toUpperCase()}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
