import { BookEntry } from "@/lib/utils";
import { LibraryControls } from "./LibraryControls";
import { BookGrid } from "./BookGrid";
import { EmptyLibraryState } from "./EmptyLibraryState";

interface LibrarySectionProps {
  filteredBooks: BookEntry[];
  totalBooks: number;
  selectedLibrary: string;
  setSelectedLibrary: (library: string) => void;
  viewMode: "card" | "list";
  setViewMode: (mode: "card" | "list") => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterBy: "all" | "reading" | "completed" | "unread";
  setFilterBy: (filter: "all" | "reading" | "completed" | "unread") => void;
  sortBy: "recent" | "title" | "author" | "progress";
  setSortBy: (sort: "recent" | "title" | "author" | "progress") => void;
  handleAddBookToLibrary: () => void;
  onBookDeleted?: () => void;
}

export function LibrarySection({
  filteredBooks,
  totalBooks,
  selectedLibrary,
  setSelectedLibrary,
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  filterBy,
  setFilterBy,
  sortBy,
  setSortBy,
  handleAddBookToLibrary,
  onBookDeleted,
}: LibrarySectionProps) {
  return (
    <section>
      <LibraryControls
        selectedLibrary={selectedLibrary}
        setSelectedLibrary={setSelectedLibrary}
        filteredBooksCount={filteredBooks.length}
        totalBooks={totalBooks}
        viewMode={viewMode}
        setViewMode={setViewMode}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterBy={filterBy}
        setFilterBy={setFilterBy}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />
      
      {filteredBooks.length === 0 ? (
        <EmptyLibraryState
          selectedLibrary={selectedLibrary}
          handleAddBookToLibrary={handleAddBookToLibrary}
          setSelectedLibrary={setSelectedLibrary}
        />
      ) : (
        <BookGrid books={filteredBooks} viewMode={viewMode} onBookDeleted={onBookDeleted} />
      )}
    </section>
  );
}