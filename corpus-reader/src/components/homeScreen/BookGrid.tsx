import { BookEntry } from "@/lib/utils";
import BookCard from "./BookCard";
import { useNavigate } from "react-router-dom";
import BookListItem from "./BookListItem";

interface BookGridProps {
  books: BookEntry[];
  viewMode: "card" | "list";
  onBookDeleted?: () => void;
}

export interface BookCardListProps {
  book: BookEntry,
  handleBookClick: (path: string) => void,
  onBookDeleted?: () => void;
}

export function BookGrid({ books, viewMode, onBookDeleted }: BookGridProps) {
  const navigate = useNavigate();

  const handleBookClick = async (bookPath: string) => {
    if (bookPath.includes("pdf"))
      navigate(`/pdf/${encodeURIComponent(bookPath)}`);
    else navigate(`/reader/${encodeURIComponent(bookPath)}`);
  };

  if (viewMode === "list") {
    return (
      <div
        className="space-y-3">
        {books.map((book) => (
          <BookListItem
            key={book.id}
            book={book}
            handleBookClick={handleBookClick}
            onBookDeleted={onBookDeleted} />

        ))}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 min-[350px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
      {books.map((book) => (
        <BookCard
          handleBookClick={handleBookClick}
          key={book.id}
          book={book}
          onBookDeleted={onBookDeleted} />
      ))}
    </div>
  );
}