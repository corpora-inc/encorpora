import { LibraryIcon, PlusIcon } from "lucide-react";
import { BookEntry } from "@/lib/utils";
import EmptyLibrary from "@/components/EmptyLibrary";
import HomeHeader from "@/components/HomeHeader";
import Loader from "@/components/Loader";
import {
  useHomeScreenState,
  useBookFiltering,
  useBookStats,
  useAddBook,
  StatsCards,
  LibrarySection,
} from "./homeScreen/index";
import { Button } from "./ui/button";
import FeaturedBookCard from "./FeaturedBookCard";

interface HomeScreenProps {
  books: BookEntry[];
  onBookAdded: () => void;
  onBookDeleted?: () => void;
}

export function HomeScreen({ books, onBookAdded, onBookDeleted }: HomeScreenProps) {
  const {
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
  } = useHomeScreenState(books);

  const { loadingBooks, handleAddBookToLibrary } = useAddBook(onBookAdded);
  const { totalBooks, booksInProgress, booksCompleted } = useBookStats(books);
  const filteredBooks = useBookFiltering({
    books,
    searchQuery,
    filterBy,
    sortBy,
  });

  // // Refresh books when window regains focus (e.g., returning from reader)
  // useEffect(() => {
  //   const handleFocus = () => {
  //     if (onBookAdded) {
  //       console.log("Window regained focus, refreshing books...");
  //       onBookAdded();
  //     }
  //   };
  //   window.addEventListener("focus", handleFocus);
  //   return () => window.removeEventListener("focus", handleFocus);
  // }, [onBookAdded]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/98 to-muted/30 safe-top safe-bottom">
      <div className="flex min-h-screen">
        {/* Main Content */}
        <div className="flex-1">
          {/* Top Navigation Bar */}
          <HomeHeader
            books={books}
            handleAddBookToLibrary={handleAddBookToLibrary}
            onBookDeleted={onBookDeleted}
          />
          {/* Content Area */}
          <div className="container px-4 py-6 mx-auto max-w-7xl">
            {books.length === 0 ? (
              loadingBooks ? (
                <Loader text="Loading book..." />
              ) : (
                <EmptyLibrary handleAddBookToLibrary={handleAddBookToLibrary} />
              )
            ) : (
              <div className="w-full space-y-8">
                {/* Stats cards */}
                <StatsCards
                  totalBooks={totalBooks}
                  booksInProgress={booksInProgress}
                  booksCompleted={booksCompleted}
                />

                {/* Featured Book */}
                {featuredBook && (
                  <section>
                    <div className="flex items-center gap-2 mb-6">
                      <h2 className="text-2xl font-bold text-foreground">
                        {featuredBook.progress > 0 && !featuredBook.is_finished
                          ? "Continue reading"
                          : featuredBook.is_finished
                          ? "Recently finished"
                          : "Recently added"}
                      </h2>
                    </div>
                    <FeaturedBookCard book={featuredBook} />
                  </section>
                )}

                {/* Library Manager */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <LibraryIcon className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-bold text-foreground">
                      My Libraries
                    </h2>
                  </div>
                </section>

                {/* Library Section */}
                <LibrarySection
                  filteredBooks={filteredBooks}
                  totalBooks={totalBooks}
                  selectedLibrary={selectedLibrary}
                  setSelectedLibrary={setSelectedLibrary}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  filterBy={filterBy}
                  setFilterBy={setFilterBy}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  handleAddBookToLibrary={handleAddBookToLibrary}
                  onBookDeleted={onBookDeleted}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating action button for mobile */}
      <div className="fixed right-4 z-50 md:hidden safe-fab">
        <Button
          onClick={handleAddBookToLibrary}
          size="icon"
          className="h-12 w-12 rounded-full "
        >
          <PlusIcon className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
