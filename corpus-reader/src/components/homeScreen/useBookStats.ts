import { useMemo } from "react";
import { BookEntry } from "@/lib/utils";

export function useBookStats(books: BookEntry[]) {
  const stats = useMemo(() => {
    const completedBooks = books.filter((book) => book.is_finished);
    const totalBooks = books.length;
    const booksInProgress = books.filter(
      (book) => book.last_read_page !== 0 && !book.is_finished
    ).length;
    const booksCompleted = completedBooks.length;

    return {
      totalBooks,
      booksInProgress,
      booksCompleted,
      completedBooks,
    };
  }, [books]);

  return stats;
}