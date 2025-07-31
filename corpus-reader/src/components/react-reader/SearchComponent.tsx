import React, { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../ui/drawer";
import { useMediaQuery } from "../../hooks/use-media-query";

export type SearchResult = {
  cfi: string;
  excerpt: string;
};

interface SearchComponentProps {
  onSearch: (query: string) => void;
  searchResults: SearchResult[];
  onResultClick: (cfi: string) => void;
  isLoading?: boolean;
}

export const SearchComponent: React.FC<SearchComponentProps> = ({
  onSearch,
  searchResults,
  onResultClick,
  isLoading = false,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debounceTimer = useRef<number | null>(null);
  // Local state to indicate searching during debounce
  const [isSearching, setIsSearching] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Indicate that a search is pending (debounce period)
    setIsSearching(true);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = window.setTimeout(() => {
      onSearch(query);
      // Debounce complete, clear local searching state
      setIsSearching(false);
    }, 500);
  };

  const handleClearSearch = () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setSearchQuery("");
    onSearch("");
  };

  const handleResultClick = (cfi: string) => {
    onResultClick(cfi);
    setOpen(false);
  };

  const SearchContent = () => (
    <div className="min-h-[400px] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Search in book..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pr-8"
            autoFocus
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSearch}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {(isLoading || isSearching) && (
        <div className="text-center py-4 text-sm">Searching...</div>
      )}

      {!isLoading && !isSearching && searchQuery && searchResults.length === 0 && (
        <div className="text-center py-4 text-sm">
          No results found for "{searchQuery}"
        </div>
      )}

      {!isLoading && !isSearching && searchResults.length > 0 && (
        <div>
          <div className="text-sm mb-2 font-medium">
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}{" "}
            found
          </div>
          <ScrollArea className="h-72">
            <div className="space-y-2">
              {searchResults.map((result, index) => (
                <div
                  key={`${result.cfi}-${index}`}
                  className="p-2 rounded cursor-pointer transition-colors hover:bg-opacity-20"
                  style={{
                    backgroundColor: "transparent",
                  }}
                  onClick={() => handleResultClick(result.cfi)}
                >
                  <div
                    className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: result.excerpt.replace(
                        new RegExp(`(${searchQuery})`, "gi"),
                        `<mark style="background-color: #ee; color: ;">$1</mark>`
                      ),
                    }}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Search in book">
            <Search className="w-5 h-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Search in Book</DialogTitle>
          </DialogHeader>
          <SearchContent />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Search in book">
          <Search className="w-5 h-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Search in Book</DrawerTitle>
        </DrawerHeader>
        <SearchContent />
      </DrawerContent>
    </Drawer>
  );
};
