import React, { useState, useCallback } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import DrawerDialog from "./DrawerDialogWrapper";
import { pdfjs } from "react-pdf";

interface SearchResult {
  pageNumber: number;
  text: string;
  matchIndex: number;
  context: string;
}

interface PdfSearchProps {
  file: string | null;
  numPages: number | null;
  onGoToPage: (pageNumber: number) => void;
  currentPage: number;
}

const PdfSearch: React.FC<PdfSearchProps> = ({
  file,
  numPages,
  onGoToPage,
  currentPage,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  // Function to normalize text by removing accents and converting to lowercase
  const normalizeText = (text: string): string => {
    return text
      .normalize('NFD') // Decompose characters with accents
      .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
      .toLowerCase()
      .trim();
  };

  // Function to find matches with normalized search
  const findNormalizedMatches = (text: string, searchTerm: string) => {
    const normalizedText = normalizeText(text);
    const normalizedSearch = normalizeText(searchTerm);
    const matches: Array<{ index: number; length: number; originalText: string }> = [];
    
    let startIndex = 0;
    while (true) {
      const index = normalizedText.indexOf(normalizedSearch, startIndex);
      if (index === -1) break;
      
      // Find the original text boundaries by counting characters
      let originalStart = index;
      let originalEnd = index + normalizedSearch.length;
      
      // Adjust for potential normalization differences
      let charCount = 0;
      for (let i = 0; i < text.length; i++) {
        if (charCount === index) {
          originalStart = i;
          break;
        }
        if (normalizeText(text[i]).length > 0) {
          charCount++;
        }
      }
      
      charCount = 0;
      for (let i = 0; i < text.length; i++) {
        if (charCount === index + normalizedSearch.length) {
          originalEnd = i;
          break;
        }
        if (normalizeText(text[i]).length > 0) {
          charCount++;
        }
      }
      
      // Ensure we don't go beyond text length
      originalEnd = Math.min(originalEnd, text.length);
      
      matches.push({
        index: originalStart,
        length: originalEnd - originalStart,
        originalText: text.substring(originalStart, originalEnd)
      });
      
      startIndex = index + 1;
    }
    
    return matches;
  };

  const searchInPdf = useCallback(async (term: string) => {
    if (!file || !term.trim() || !numPages) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const results: SearchResult[] = [];

    try {
      const pdf = await pdfjs.getDocument(file).promise;
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");

        const matches = findNormalizedMatches(pageText, term);
        
        matches.forEach((match, matchIndex) => {
          const start = Math.max(0, match.index - 50);
          const end = Math.min(pageText.length, match.index + match.length + 50);
          const context = pageText.substring(start, end);
          
          results.push({
            pageNumber: pageNum,
            text: match.originalText,
            matchIndex: matchIndex,
            context: context,
          });
        });
      }
    } catch (error) {
      console.error("Error searching PDF:", error);
    }

    setSearchResults(results);
    setCurrentResultIndex(0);
    setIsSearching(false);
  }, [file, numPages]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term.length >= 2) {
      searchInPdf(term);
    } else {
      setSearchResults([]);
    }
  };

  const goToResult = (result: SearchResult, index: number) => {
    setCurrentResultIndex(index);
    onGoToPage(result.pageNumber);
  };

  const goToNextResult = () => {
    if (searchResults.length > 0) {
      const nextIndex = (currentResultIndex + 1) % searchResults.length;
      goToResult(searchResults[nextIndex], nextIndex);
    }
  };

  const goToPrevResult = () => {
    if (searchResults.length > 0) {
      const prevIndex = currentResultIndex === 0 
        ? searchResults.length - 1 
        : currentResultIndex - 1;
      goToResult(searchResults[prevIndex], prevIndex);
    }
  };

  const highlightMatch = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  const clearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
    setCurrentResultIndex(0);
  };

  return (
    <DrawerDialog
      trigger={
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Search in PDF"
        >
          <Search className="h-4 w-4" />
        </Button>
      }
      title="Search PDF"
      description="Search for text within the PDF document"
      drawerCloseButton={
        <Button variant="outline" className="w-full">
          Close
        </Button>
      }
    >
      <div className="p-4 space-y-4 h-96">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search text in PDF..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 pr-10"
            autoFocus
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Search Status */}
        {searchTerm && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {isSearching ? "Searching..." : `${searchResults.length} results`}
              </Badge>
              {searchResults.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {currentResultIndex + 1} of {searchResults.length}
                </span>
              )}
            </div>
            
            {searchResults.length > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPrevResult}
                  className="h-7 w-7 p-0"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextResult}
                  className="h-7 w-7 p-0"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {searchResults.map((result, index) => (
                <div
                  key={`${result.pageNumber}-${result.matchIndex}`}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                    index === currentResultIndex 
                      ? "bg-primary/10 border-primary" 
                      : "bg-card"
                  }`}
                  onClick={() => goToResult(result, index)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">
                      Page {result.pageNumber}
                    </Badge>
                    {index === currentResultIndex && (
                      <Badge variant="default" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {highlightMatch(result.context, searchTerm)}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* No Results */}
        {searchTerm && !isSearching && searchResults.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No results found for "{searchTerm}"</p>
            <p className="text-xs mt-1">Try different keywords or check spelling</p>
          </div>
        )}

        {/* Search Instructions */}
        {!searchTerm && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Enter at least 2 characters to search</p>
            <p className="text-xs mt-1">Search will look through all pages of the PDF</p>
          </div>
        )}
      </div>
    </DrawerDialog>
  );
};

export default PdfSearch;