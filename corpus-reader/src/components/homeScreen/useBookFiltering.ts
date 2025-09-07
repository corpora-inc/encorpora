import { useMemo } from "react";
import { BookEntry } from "@/lib/utils";

interface UseBookFilteringProps {
  books: BookEntry[];
  searchQuery: string;
  filterBy: "all" | "reading" | "completed" | "unread";
  sortBy: "recent" | "title" | "author" | "progress";
}

export function useBookFiltering({
  books,
  searchQuery,
  filterBy,
  sortBy,
}: UseBookFilteringProps) {
  const filteredBooks = useMemo(() => {
    let filtered = books;

    // Apply text search
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (book) =>
          book.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          book.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          book.publisher?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    switch (filterBy) {
      case "reading":
        filtered = filtered.filter(
          (book) => book.progress > 0 && !book.is_finished
        );
        break;
      case "completed":
        filtered = filtered.filter((book) => book.is_finished);
        break;
      case "unread":
        filtered = filtered.filter((book) => book.progress === 0);
        break;
      default:
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "title":
          return (a.title || "").localeCompare(b.title || "");
        case "author":
          return (a.author || "").localeCompare(b.author || "");
        case "progress":
          return (b.progress || 0) - (a.progress || 0);
        default:
          return (
            new Date(b.added_to_library_at).getTime() -
            new Date(a.added_to_library_at).getTime()
          );
      }
    });
  }, [books, searchQuery, filterBy, sortBy]);

  return filteredBooks;
}