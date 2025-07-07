import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookEntry } from "@/lib/utils";
import BookCard from "@/components/BookCard";
import EmptyLibrary from "@/components/EmptyLibrary";
import {
  LayoutDashboardIcon,
  ListIcon,
  PlusIcon,
  TrendingUpIcon,
  StarIcon,
  BookOpenIcon,
  FilterIcon,
  SortAscIcon,
  SearchIcon,
  LibraryIcon,
  FolderIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import FeaturedBookCard from "@/components/FeaturedBookCard";
import HomeHeader from "@/components/HomeHeader";
import Loader from "@/components/Loader";
import { invoke } from "@tauri-apps/api/core";

interface HomeScreenProps {
  books: BookEntry[];
  onBookAdded: () => void;
}

export function HomeScreen({ books, onBookAdded }: HomeScreenProps) {
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [loadingBooks, setLoadingBooks] = useState(false);
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

  // Refresh books when window regains focus (e.g., returning from reader)
  useEffect(() => {
    const handleFocus = () => {
      if (onBookAdded) {
        console.log("Window regained focus, refreshing books...");
        onBookAdded();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [onBookAdded]);

  const completedBooks = books.filter((book) => book.is_finished);
  const totalBooks = books.length;
  const booksInProgress = books.filter(
    (book) => book.last_read_page !== 0 && !book.is_finished
  ).length;
  const booksCompleted = completedBooks.length;

  const getFilteredBooks = () => {
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
  };

  const filteredBooks = getFilteredBooks();

  const handleAddBookToLibrary = async () => {
    let message = "";
    try {
      setLoadingBooks(true);
      message = await invoke("pick_file");
      onBookAdded();

    } catch (error) {
      console.error("Error opening file dialog or adding book:", error);
      toast.error("Could not open or process the EPUB file.");
    } finally {
      setLoadingBooks(false);
      toast.info(message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/98 to-muted/30 safe-top safe-bottom">
      <div className="flex min-h-screen">
        {/* Main Content */}
        <div className="flex-1">
          {/* Top Navigation Bar */}
          <HomeHeader
            books={books}
            handleAddBookToLibrary={handleAddBookToLibrary}
          />
          {/* Content Area */}
          <div className="container px-4 py-6 mx-auto max-w-7xl">
            {books.length === 0 ? (
              loadingBooks ? (
                <Loader text="Loading book..." />
              ) : (
                <EmptyLibrary
                  handleAddBookToLibrary={handleAddBookToLibrary}
                />
              )
            ) : (
              <div className="w-full space-y-8">
                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <BookOpenIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {totalBooks}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Total Books
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <TrendingUpIcon className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {booksInProgress}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          In Progress
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <StarIcon className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {booksCompleted}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Completed
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
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
                <section>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-3">
                      <FolderIcon className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-bold text-foreground">
                        {selectedLibrary === "all"
                          ? "Library"
                          : selectedLibrary === "favorites"
                            ? "Favorite "
                            : selectedLibrary === "currently-reading"
                              ? "Currently Reading"
                              : selectedLibrary === "want-to-read"
                                ? "Want to"
                                : "Custom Library"}
                      </h2>
                      <Badge variant="outline" className="text-xs">
                        {filteredBooks.length} of {totalBooks} books
                      </Badge>
                      {selectedLibrary !== "all" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLibrary("all")}
                          className="text-xs px-2 py-1 h-6"
                        >
                          View All
                        </Button>
                      )}
                      <Tabs
                        value={viewMode}
                        onValueChange={(value) =>
                          setViewMode(value as "card" | "list")
                        }
                        className="w-auto"
                      >
                        <TabsList className="h-8 px-1">
                          <TabsTrigger value="card" className="h-6 w-7 px-0">
                            <LayoutDashboardIcon className="w-4 h-4" />
                          </TabsTrigger>
                          <TabsTrigger value="list" className="h-6 w-7 px-0">
                            <ListIcon className="w-4 h-4" />
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
                      <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 border border-border/40">
                        <SearchIcon className="h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search books..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground w-full"
                          aria-label="Search books"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <FilterIcon className="h-4 w-4 text-muted-foreground" />
                          <Select
                            value={filterBy}
                            onValueChange={(value: any) => setFilterBy(value)}
                          >
                            <SelectTrigger className="w-36 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Books</SelectItem>
                              <SelectItem value="reading">Reading</SelectItem>
                              <SelectItem value="completed">
                                Completed
                              </SelectItem>
                              <SelectItem value="unread">Unread</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <SortAscIcon className="h-4 w-4 text-muted-foreground" />
                          <Select
                            value={sortBy}
                            onValueChange={(value: any) => setSortBy(value)}
                          >
                            <SelectTrigger className="w-36 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="recent">Recent</SelectItem>
                              <SelectItem value="title">Title</SelectItem>
                              <SelectItem value="author">Author</SelectItem>
                              <SelectItem value="progress">Progress</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                  {viewMode === "list" ? (
                    <div className="space-y-3">
                      {filteredBooks.map((book) => (
                        <BookCard key={book.id} book={book} kind="list" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                      {filteredBooks.map((book) => (
                        <BookCard key={book.id} book={book} kind="card" />
                      ))}
                    </div>
                  )}
                  {filteredBooks.length === 0 && (
                    <div className="text-center py-12">
                      <div className="mx-auto w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                        {selectedLibrary === "all" ? (
                          <BookOpenIcon className="h-8 w-8 text-muted-foreground" />
                        ) : (
                          <FolderIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        {selectedLibrary === "all"
                          ? "No books found"
                          : selectedLibrary === "favorites"
                            ? "No favorite books yet"
                            : selectedLibrary === "currently-reading"
                              ? "No books in progress"
                              : selectedLibrary === "want-to-read"
                                ? "No books in your wishlist"
                                : "Library is empty"}
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {selectedLibrary === "all"
                          ? "Try adjusting your filters or add some books to your library."
                          : selectedLibrary === "favorites"
                            ? "Mark some books as favorites to see them here."
                            : selectedLibrary === "currently-reading"
                              ? "Start reading a book to track your progress here."
                              : selectedLibrary === "want-to-read"
                                ? "Add books you want to read to this wishlist."
                                : `No books match the current filters in this library.`}
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={handleAddBookToLibrary}
                          className="gap-2"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add Books
                        </Button>
                        {selectedLibrary !== "all" && (
                          <Button
                            variant="outline"
                            onClick={() => setSelectedLibrary("all")}
                            className="gap-2"
                          >
                            <LibraryIcon className="h-4 w-4" />
                            Browse All Books
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating action button for mobile */}
      <div
        className="fixed right-4 z-50 md:hidden safe-fab"
      >
        <Button
          onClick={handleAddBookToLibrary}
          size="icon"
          className="h-14 w-14 rounded-full shadow-2xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground border-2 border-background/20"
        >
          <PlusIcon className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
