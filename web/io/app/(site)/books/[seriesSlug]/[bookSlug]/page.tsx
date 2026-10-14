import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  bookCatalog,
  categoryLabel,
  getBook,
  languageName,
} from "@/lib/bookCatalog";
import { withBasePath } from "@/lib/basePath";

interface PageProps {
  params: Promise<{ seriesSlug: string; bookSlug: string }>;
}

export function generateStaticParams() {
  const params: { seriesSlug: string; bookSlug: string }[] = [];
  for (const s of bookCatalog.series) {
    for (const b of s.books) {
      params.push({ seriesSlug: s.slug, bookSlug: b.slug });
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
  const description = `${book.title} — part of the ${series.title} series. ${
    book.estimatedListenTime
      ? `About ${book.estimatedListenTime} to listen.`
      : ""
  } Free narration for the Corpan reader packs.`.trim();
  return {
    title: `${book.title} — Encorpora`,
    description,
    openGraph: {
      title: book.title,
      description,
      type: "book",
    },
  };
}

export default async function BookDetailPage({ params }: PageProps) {
  const { seriesSlug, bookSlug } = await params;
  const found = getBook(seriesSlug, bookSlug);
  if (!found) notFound();
  const { series, book } = found;

  return (
    <div className="px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-8">
          <Link
            href={withBasePath("/books/")}
            className="hover:text-black transition-colors"
          >
            Books
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={withBasePath(`/books/${series.slug}/`)}
            className="hover:text-black transition-colors"
          >
            {series.title}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{book.title}</span>
        </nav>

        {/* Book header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4 text-xs uppercase tracking-wider font-medium text-gray-400">
            <span>{categoryLabel(series.category)}</span>
            <span className="text-gray-300">·</span>
            <span>{series.title}</span>
            {book.volume != null && (
              <>
                <span className="text-gray-300">·</span>
                <span>Volume {book.volume}</span>
              </>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-tight mb-4">
            {book.title}
          </h1>
          <p className="text-gray-500">by {book.author}</p>
        </header>

        {/* Key stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12 py-6 border-y border-gray-100">
          {book.estimatedReadTime && (
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                Read
              </div>
              <div className="text-sm font-medium text-gray-900">
                {book.estimatedReadTime}
              </div>
            </div>
          )}
          {book.estimatedListenTime && (
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                Listen
              </div>
              <div className="text-sm font-medium text-gray-900">
                {book.estimatedListenTime}
              </div>
            </div>
          )}
          {book.chapterCount > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                Chapters
              </div>
              <div className="text-sm font-medium text-gray-900">
                {book.chapterCount}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">
              Price
            </div>
            <div className="text-sm font-medium text-gray-900">Free</div>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 mb-16">
          {book.hasPreview && (
            <Link
              href={withBasePath(
                `/books/${series.slug}/${book.slug}/read/`
              )}
              className="inline-flex items-center px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Read a preview &rarr;
            </Link>
          )}
          <Link
            href={withBasePath("/corpan/packs/stargate-reader/")}
            className="inline-flex items-center px-6 py-3 bg-white text-gray-900 font-medium rounded-lg border border-gray-200 hover:border-gray-900 transition-colors"
          >
            Listen in Corpan
          </Link>
        </div>

        {/* Chapters */}
        {book.chapters.length > 0 && (
          <section className="mb-16">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Chapters</h2>
            <ol className="space-y-2">
              {book.chapters.map((ch) => (
                <li
                  key={ch.number}
                  className="flex items-baseline gap-4 py-3 border-b border-gray-100 last:border-0"
                >
                  <span className="text-xs text-gray-400 font-mono w-6 flex-shrink-0">
                    {String(ch.number).padStart(2, "0")}
                  </span>
                  <span className="text-gray-900 flex-1">{ch.title}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Narration languages */}
        <section className="mb-16">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Available Narrations
          </h2>
          <p className="text-gray-600 text-sm mb-4">
            Narrated in the following languages. Download in Corpan to listen.
          </p>
          <div className="flex flex-wrap gap-2">
            {book.narrationLanguages.map((lang) => (
              <span
                key={lang}
                className="text-sm px-3 py-1 bg-gray-50 text-gray-700 rounded-full border border-gray-100"
              >
                {languageName(lang)}
              </span>
            ))}
          </div>
        </section>

        {/* Get Corpan */}
        <section className="mt-24 pt-12 border-t border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            Listen in Corpan
          </h2>
          <p className="text-gray-600 text-sm mb-6 max-w-xl">
            The full audiobook, with word-level sync and offline playback, is
            available in the Corpan app via the Stargate and Earthgate reader
            packs.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://apps.apple.com/gb/app/corp%C3%A1n/id6746082061"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center px-5 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Download on iOS
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.corpora.corpan"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center px-5 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Get it on Android
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
