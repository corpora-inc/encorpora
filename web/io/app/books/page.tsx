import Link from "next/link";
import type { Metadata } from "next";
import { bookCatalog, categoryLabel } from "@/lib/bookCatalog";
import { withBasePath } from "@/lib/basePath";
import printBooksData from "@/data/books.json";

interface PrintBook {
  id: string;
  title: string;
  description: string;
  amazonUrl: string;
  coverImage: string;
  featured: boolean;
}

export const metadata: Metadata = {
  title: "Books — Encorpora",
  description:
    "Narration books and print titles from Corpora. Free audiobook narrations for the Corpan reader packs, across sports, history, and more.",
};

export default function BooksPage() {
  const printBooks = printBooksData as PrintBook[];
  const series = bookCatalog.series;

  return (
    <div className="px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <header className="text-center mb-20">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
            Books
          </h1>
          <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto leading-relaxed">
            Free narrations for Corpan&rsquo;s reader packs. Concise, fact-dense
            titles you can read on the web or listen to in the app.
          </p>
        </header>

        {/* Narration series */}
        <section className="mb-24">
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Narration Series
            </h2>
            <p className="text-gray-600 mt-2">
              Browse by series. Each title ships as a free narration pack for
              the Stargate and Earthgate readers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {series.map((s) => (
              <Link
                key={s.slug}
                href={withBasePath(`/books/${s.slug}/`)}
                className="group block bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs uppercase tracking-wider font-medium text-gray-400">
                    {categoryLabel(s.category)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {s.bookCount} {s.bookCount === 1 ? "book" : "books"}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-black transition-colors">
                  {s.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {s.books
                    .slice(0, 3)
                    .map((b) => b.title)
                    .join(" · ")}
                  {s.books.length > 3 ? " · …" : ""}
                </p>
                <span className="inline-block mt-4 text-sm text-gray-500 group-hover:text-black transition-colors">
                  Browse series &rarr;
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Print books */}
        {printBooks.length > 0 && (
          <section>
            <div className="mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                Print Books
              </h2>
              <p className="text-gray-600 mt-2">Available on Amazon.</p>
            </div>
            {printBooks.map((book) => (
              <div
                key={book.id}
                className="flex flex-col md:flex-row items-center gap-10 md:gap-16 mb-16"
              >
                <div className="flex-shrink-0 w-64 sm:w-72 md:w-80">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gray-200 rounded-lg transform rotate-2 scale-[1.02]" />
                    <img
                      src={withBasePath(book.coverImage)}
                      alt={book.title}
                      className="relative rounded-lg shadow-xl w-full h-auto"
                    />
                  </div>
                </div>
                <div className="flex flex-col items-center md:items-start text-center md:text-left">
                  <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-4 leading-tight">
                    {book.title}
                  </h3>
                  <p className="text-gray-600 text-base leading-relaxed mb-6 max-w-lg">
                    {book.description}
                  </p>
                  <a
                    href={book.amazonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Buy on Amazon <span className="ml-2">&rarr;</span>
                  </a>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
