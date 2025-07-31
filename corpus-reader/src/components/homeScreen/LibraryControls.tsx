import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboardIcon,
  ListIcon,
  FilterIcon,
  SortAscIcon,
  SearchIcon,
  FolderIcon,
} from "lucide-react";

interface LibraryControlsProps {
  selectedLibrary: string;
  setSelectedLibrary: (library: string) => void;
  filteredBooksCount: number;
  totalBooks: number;
  viewMode: "card" | "list";
  setViewMode: (mode: "card" | "list") => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterBy: "all" | "reading" | "completed" | "unread";
  setFilterBy: (filter: "all" | "reading" | "completed" | "unread") => void;
  sortBy: "recent" | "title" | "author" | "progress";
  setSortBy: (sort: "recent" | "title" | "author" | "progress") => void;
}

export function LibraryControls({
  selectedLibrary,
  setSelectedLibrary,
  filteredBooksCount,
  totalBooks,
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  filterBy,
  setFilterBy,
  sortBy,
  setSortBy,
}: LibraryControlsProps) {
  const getLibraryTitle = () => {
    switch (selectedLibrary) {
      case "all":
        return "Library";
      case "favorites":
        return "Favorite";
      case "currently-reading":
        return "Currently Reading";
      case "want-to-read":
        return "Want to";
      default:
        return "Custom Library";
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
      <div className="flex items-center gap-3">
        <FolderIcon className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground">
          {getLibraryTitle()}
        </h2>
        <Badge variant="outline" className="text-xs">
          {filteredBooksCount} of {totalBooks} books
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
          onValueChange={(value) => setViewMode(value as "card" | "list")}
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
                <SelectItem value="completed">Completed</SelectItem>
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
  );
}