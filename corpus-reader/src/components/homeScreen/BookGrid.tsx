import { BookEntry } from "@/lib/utils";
import BookCard from "@/components/BookCard";

interface BookGridProps {
  books: BookEntry[];
  viewMode: "card" | "list";
}

export function BookGrid({ books, viewMode }: BookGridProps) {
  if (viewMode === "list") {
    return (
      <div className="space-y-3">
        {books.map((book) => (
          <BookCard key={book.id} book={book} kind="list" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
      {books.map((book) => (
        <BookCard key={book.id} book={book} kind="card" />
      ))}
    </div>
  );
}