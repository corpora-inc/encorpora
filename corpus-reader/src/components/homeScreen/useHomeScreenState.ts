import { useState, useEffect } from "react";
import { BookEntry } from "@/lib/utils";

export function useHomeScreenState(books: BookEntry[]) {
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [sortBy, setSortBy] = useState<
    "recent" | "title" | "author" | "progress"
  >("recent");
  const [filterBy, setFilterBy] = useState<
    "all" | "reading" | "completed" | "unread"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLibrary, setSelectedLibrary] = useState<string>("all");
  const [featuredBook, setFeaturedBook] = useState<BookEntry | null>(null);

  // Update featured book whenever books array changes
  useEffect(() => {
    if (books.length > 0) {
      const mostRecentBook = books.reduce((latest, current) => {
        if (!latest) return current;
        const latestDate = new Date(latest.last_read).getTime();
        const currentDate = new Date(current.last_read).getTime();
        return currentDate > latestDate ? current : latest;
      }, books[0]);
      setFeaturedBook(mostRecentBook);
    } else {
      setFeaturedBook(null);
    }
  }, [books]);

  return {
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    filterBy,
    setFilterBy,
    searchQuery,
    setSearchQuery,
    selectedLibrary,
    setSelectedLibrary,
    featuredBook,
  };
}
