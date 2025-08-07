import {
  readFileSrc,
  updateBookProgress,
  getBookInformation,
  BookEntry,
} from "@/lib/utils";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  AlertCircle,
  Loader2,
  Grid3X3,
  ScrollText,
  ArrowUpDown,
  Moon,
  Sun,
  ArrowLeft,
  Lightbulb,
  Minus,
  Plus,
  Menu,
} from "lucide-react";
import PdfToc from "./pdfViewer/PdfToc";
import PdfSearch from "./PdfSearch";
import { useTheme } from "@/components/ThemeProvider";
import { usePdfViewerStore } from "@/store/usePdfViewerStore";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

interface DocumentLoadSuccess {
  numPages: number;
}

function BasicPdfRender() {
  const { bookPath } = useParams<{ bookPath: string }>();
  const { theme, setTheme } = useTheme();

  // Use Zustand store for persistent settings
  const {
    settings,
    setScale,
    setRotation,
    setViewMode,
    setReadingMode,
    setBrightness,
  } = usePdfViewerStore();

  // Local state for non-persistent values
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookInfo, setBookInfo] = useState<BookEntry | null>(null);
  // Header visibility state
  const [headerVisible, setHeaderVisible] = useState(false);
  // Responsive scale state
  const [responsiveScale, setResponsiveScale] = useState<number>(1);

  // Use ref to track the last saved page to avoid unnecessary updates
  const lastSavedPageRef = useRef<number>(1);

  // Ref for scroll container to implement intersection observer
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevReadingModeRef = useRef<"page" | "vertical" | null>(null);
  const hasPositionedInitiallyRef = useRef(false);
  const headerHideTimeoutRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const tapCountRef = useRef<number>(0);
  const headerRef = useRef<HTMLDivElement>(null);

  // Extract settings from store
  const { scale, rotation, viewMode, readingMode, brightness } = settings;

  // Calculate responsive scale based on viewport and device
  const calculateResponsiveScale = useCallback(() => {
    // Safe window access for SSR compatibility
    if (typeof window === "undefined") return scale;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Base scale factors for different device types
    let baseScale = 1;

    if (viewportWidth <= 480) {
      // Mobile phones - smaller scale for better fit
      baseScale = 0.6;
    } else if (viewportWidth <= 768) {
      // Tablets - medium scale
      baseScale = 0.8;
    } else if (viewportWidth <= 1024) {
      // Small laptops - slightly larger
      baseScale = 0.9;
    } else {
      // Desktop - full scale
      baseScale = 1.0;
    }

    // Adjust for viewport height on mobile devices
    if (viewportWidth <= 768 && viewportHeight <= 800) {
      baseScale *= 0.85;
    }

    // Apply user's scale preference on top of responsive base
    return baseScale * scale;
  }, [scale]);

  // Update responsive scale on window resize and scale changes
  useEffect(() => {
    const updateResponsiveScale = () => {
      setResponsiveScale(calculateResponsiveScale());
    };

    updateResponsiveScale();

    // Handle both resize and orientation change events
    window.addEventListener("resize", updateResponsiveScale);
    window.addEventListener("orientationchange", updateResponsiveScale);

    return () => {
      window.removeEventListener("resize", updateResponsiveScale);
      window.removeEventListener("orientationchange", updateResponsiveScale);
    };
  }, [calculateResponsiveScale]);

  // Load book information and restore last read page
  useEffect(() => {
    if (!bookPath) {
      console.log("No bookPath provided");
      return;
    }

    const loadBookInfo = async () => {
      try {
        const info = await getBookInformation(bookPath);
        if (info) {
          setBookInfo(info);
          // Restore last read page if available
          if (info.last_read_page && info.last_read_page > 0) {
            setCurrentPage(info.last_read_page);
            lastSavedPageRef.current = info.last_read_page;
            console.log(`Restored last read page: ${info.last_read_page}`);
          }
        }
      } catch (error) {
        console.error("Error loading book information:", error);
      }
    };

    loadBookInfo();
  }, [bookPath]);

  // Load PDF file
  useEffect(() => {
    if (!bookPath) {
      console.log("No bookPath provided");
      return;
    }

    console.log("Loading PDF from path:", bookPath);
    setLoading(true);
    setError(null);
    setFile(null);

    let isActive = true;

    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isActive) {
        console.error("PDF loading timeout");
        setError("PDF loading timed out. Please try again.");
        setLoading(false);
      }
    }, 15000); // 15 second timeout

    readFileSrc(bookPath)
      .then(async (fileData) => {
        if (!isActive) return;

        console.log("File data received:", fileData);
        console.log("File data type:", typeof fileData);
        setFile(fileData);
        setError(null);
        setLoading(false); // Set loading to false immediately after getting file data
        clearTimeout(timeoutId);
      })
      .catch((error) => {
        if (!isActive) return;

        console.error("Error loading book:", error);
        setError(`Failed to load PDF file: ${error.message}`);
        setLoading(false);
        clearTimeout(timeoutId);
      });

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [bookPath]);

  // Update progress when current page changes
  useEffect(() => {
    if (!bookPath || !numPages || currentPage === lastSavedPageRef.current) {
      return;
    }

    // Debounce the progress update to avoid too many database calls
    const timeoutId = setTimeout(async () => {
      try {
        const progress = Math.round((currentPage / numPages) * 100);
        await updateBookProgress(bookPath, currentPage, progress);
        lastSavedPageRef.current = currentPage;
        console.log(
          `Progress updated: Page ${currentPage}/${numPages} (${progress}%)`
        );
      } catch (error) {
        console.error("Error updating book progress:", error);
      }
    }, 1000); // Wait 1 second before saving to avoid rapid updates

    return () => clearTimeout(timeoutId);
  }, [currentPage, numPages, bookPath]);

  // Intersection Observer for vertical scroll mode to track current page
  useEffect(() => {
    if (readingMode !== "vertical" || !numPages) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the page that's most visible
        let mostVisiblePage = 1;
        let maxVisibility = 0;

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageId = entry.target.id;
            const pageNumber = parseInt(pageId.replace("page-", ""));

            // Use intersection ratio to determine which page is most visible
            if (entry.intersectionRatio > maxVisibility) {
              maxVisibility = entry.intersectionRatio;
              mostVisiblePage = pageNumber;
            }
          }
        });

        // Only update if the page actually changed
        if (mostVisiblePage !== currentPage && maxVisibility > 0.3) {
          setCurrentPage(mostVisiblePage);
        }
      },
      {
        threshold: [0.1, 0.3, 0.5, 0.7, 0.9],
        rootMargin: "-10% 0px -10% 0px",
      }
    );

    // Observe all page elements
    const pageElements = document.querySelectorAll('[id^="page-"]');
    pageElements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, [readingMode, numPages]);

  // Scroll to saved page only when switching to vertical mode or on initial position
  useEffect(() => {
    const justSwitchedToVertical =
      prevReadingModeRef.current &&
      prevReadingModeRef.current !== readingMode &&
      readingMode === "vertical";

    if (
      (justSwitchedToVertical || !hasPositionedInitiallyRef.current) &&
      readingMode === "vertical"
    ) {
      const targetPage =
        currentPage > 1 ? currentPage : lastSavedPageRef.current;
      const timeoutId = window.setTimeout(() => {
        const pageElement = document.getElementById(`page-${targetPage}`);
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: "auto", block: "start" });
        }
        hasPositionedInitiallyRef.current = true;
      }, 120);
      return () => window.clearTimeout(timeoutId);
    }
  }, [readingMode]);

  // Track previous reading mode
  useEffect(() => {
    prevReadingModeRef.current = readingMode;
  }, [readingMode]);

  // Header visibility helpers
  const showHeader = useCallback(() => {
    setHeaderVisible(true);
    if (headerHideTimeoutRef.current) {
      window.clearTimeout(headerHideTimeoutRef.current);
    }
    headerHideTimeoutRef.current = window.setTimeout(() => {
      setHeaderVisible(false);
    }, 3000);
  }, []);

  const suppressClickUntilRef = useRef<number>(0);

  const handleContainerClick = useCallback(() => {
    const now = Date.now();
    if (now < suppressClickUntilRef.current) return; // ignore right after touch
    showHeader();
  }, [showHeader]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (e.clientY <= 120) {
        showHeader();
      }
    },
    [showHeader]
  );

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // If the touch is interacting with the header or its children, do not interfere
    const target = e.target as Node | null;
    if (target && headerRef.current && headerRef.current.contains(target)) {
      return;
    }
    // prevent synthetic click from toggling header again on content taps
    e.preventDefault();
    const now = Date.now();
    if (now - lastTapTimeRef.current < 350) {
      tapCountRef.current += 1;
    } else {
      tapCountRef.current = 1;
    }
    lastTapTimeRef.current = now;

    if (tapCountRef.current >= 2) {
      showHeader();
      tapCountRef.current = 0;
    }
    // suppress subsequent click for a short window
    suppressClickUntilRef.current = now + 500;
  }, []);

  useEffect(() => {
    return () => {
      if (headerHideTimeoutRef.current) {
        window.clearTimeout(headerHideTimeoutRef.current);
      }
    };
  }, []);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: DocumentLoadSuccess) => {
      console.log("PDF loaded successfully with", numPages, "pages");
      setNumPages(numPages);
      setError(null);
      setLoading(false);
    },
    []
  );

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error("PDF load error:", err);
    setError(`Failed to load PDF: ${err.message}`);
    setLoading(false);
  }, []);

  const goToPrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(numPages || 1, prev + 1));
  };

  const zoomIn = () => {
    const increment =
      typeof window !== "undefined" && window.innerWidth <= 768 ? 0.1 : 0.2; // Smaller increments on mobile
    setScale(Math.min(scale + increment, 3));
  };

  const zoomOut = () => {
    const decrement =
      typeof window !== "undefined" && window.innerWidth <= 768 ? 0.1 : 0.2; // Smaller decrements on mobile
    setScale(Math.max(scale - decrement, 0.3));
  };

  const rotate = () => {
    setRotation(rotation + 90);
  };

  const goToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);

    if (readingMode === "vertical") {
      // In vertical mode, scroll to the specific page
      const pageElement = document.getElementById(`page-${pageNumber}`);
      if (pageElement) {
        pageElement.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    } else {
      // In page mode, switch to single view
      setViewMode("single");
    }
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === "single" ? "grid" : "single");
  };

  const cycleReadingMode = () => {
    setReadingMode(readingMode === "page" ? "vertical" : "page");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const increaseBrightness = () => {
    setBrightness(brightness + 10);
  };

  const decreaseBrightness = () => {
    setBrightness(brightness - 10);
  };

  // Keyboard navigation in page mode (Arrow keys)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (readingMode !== "page") return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tagName = target.tagName?.toLowerCase();
      const isEditable =
        target.isContentEditable ||
        ["input", "textarea", "select"].includes(tagName);
      if (isEditable) return;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        goToNextPage();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        goToPrevPage();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () =>
      window.removeEventListener("keydown", handleKeyDown as EventListener);
  }, [readingMode, goToNextPage, goToPrevPage]);

  const getReadingModeIcon = () => {
    switch (readingMode) {
      case "page":
        return <ScrollText className="h-4 w-4" />;
      case "vertical":
        return <ArrowUpDown className="h-4 w-4" />;
    }
  };

  const getReadingModeTitle = () => {
    switch (readingMode) {
      case "page":
        return "Page Mode - Click for Vertical Scroll";
      case "vertical":
        return "Vertical Scroll - Click for Page Mode";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h3 className="text-lg font-semibold mb-2">Loading PDF</h3>
          <p className="text-muted-foreground">
            Please wait while we load your document...
          </p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading PDF</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-screen bg-background overflow-hidden"
      onClick={handleContainerClick}
      onMouseMove={handleMouseMove}
      onTouchEnd={handleTouchEnd}
      ref={scrollContainerRef}
    >
      {/* Floating Header with controls (hidden by default) */}
      <div
        className={`border-b bg-card/90 shadow-md backdrop-blur-sm fixed top-0 left-0 right-0 z-50 transition-all duration-200 ease-out ${
          headerVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-3 pointer-events-none"
        }`}
        ref={headerRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Header Row */}
        <div className="flex items-center justify-between p-3 md:p-4">
          {/* Left side - Back button and title */}
          <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.back()}
              ariseta-label="Back"
              className="shrink-0"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
            <div className="flex items-center gap-1 md:gap-2 min-w-0">
              <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
              <span className="font-medium text-sm md:text-base truncate">
                {bookInfo?.title}
              </span>
            </div>
            {numPages && (
              <Badge
                variant="secondary"
                className="hidden sm:inline-flex text-xs"
              >
                {numPages} page{numPages !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {/* Center - Page info and navigation (mobile-first) */}
          <div className="flex items-center gap-1 md:gap-2 mx-2 md:mx-4">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
              className="h-8 px-2 md:px-3"
            >
              <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline ml-1">Prev</span>
            </Button>

            {numPages && (
              <div className="flex items-center gap-1 md:gap-2 px-1 md:px-2">
                <span className="text-xs md:text-sm font-medium whitespace-nowrap">
                  {currentPage}/{numPages}
                </span>
                <div className="w-12 md:w-16 hidden sm:block">
                  <Progress
                    value={(currentPage / numPages) * 100}
                    className="h-1.5 md:h-2"
                  />
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage >= (numPages || 0)}
              className="h-8 px-2 md:px-3"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          </div>

          {/* Right side - Menu toggle and essential controls */}
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            {/* Essential controls always visible */}
            <div className="flex items-center gap-1 md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomOut}
                disabled={scale <= 0.5}
                className="h-8 w-8 p-0"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomIn}
                disabled={scale >= 3}
                className="h-8 w-8 p-0"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
            </div>

            {/* Mobile drawer toggle */}
            <Drawer>
              <DrawerTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 md:hidden"
                  aria-label="Open settings"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>PDF Settings</DrawerTitle>
                </DrawerHeader>
                <div className="p-4 pb-8">
                  <div className="grid grid-cols-2 gap-4">
                    {/* View Controls */}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        View
                      </div>
                      <div className="space-y-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cycleReadingMode}
                          className="w-full h-10 justify-start gap-3"
                        >
                          {getReadingModeIcon()}
                          <span className="text-sm">
                            {readingMode === "page"
                              ? "Page Mode"
                              : "Scroll Mode"}
                          </span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleViewMode}
                          className="w-full h-10 justify-start gap-3"
                        >
                          <Grid3X3 className="h-4 w-4" />
                          <span className="text-sm">
                            {viewMode === "single"
                              ? "Single View"
                              : "Grid View"}
                          </span>
                        </Button>
                      </div>
                    </div>

                    {/* Tools */}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Tools
                      </div>
                      <div className="space-y-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={rotate}
                          className="w-full h-10 justify-start gap-3"
                        >
                          <RotateCw className="h-4 w-4" />
                          <span className="text-sm">Rotate</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleTheme}
                          className="w-full h-10 justify-start gap-3"
                        >
                          {theme === "dark" ? (
                            <Sun className="h-4 w-4" />
                          ) : (
                            <Moon className="h-4 w-4" />
                          )}
                          <span className="text-sm">
                            {theme === "dark" ? "Light Mode" : "Dark Mode"}
                          </span>
                        </Button>
                      </div>
                    </div>

                    {/* Zoom Control */}
                    <div className="col-span-2 space-y-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Zoom
                      </div>
                      <div className="flex items-center gap-3 bg-muted/30 rounded-xl p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={zoomOut}
                          disabled={scale <= 0.5}
                          className="h-10 w-10 p-0 rounded-full"
                        >
                          <ZoomOut className="h-5 w-5" />
                        </Button>
                        <div className="flex-1 text-center">
                          <span className="text-lg font-semibold">
                            {Math.round(responsiveScale * 100)}%
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={zoomIn}
                          disabled={scale >= 3}
                          className="h-10 w-10 p-0 rounded-full"
                        >
                          <ZoomIn className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>

                    {/* Brightness Control */}
                    <div className="col-span-2 space-y-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Brightness
                      </div>
                      <div className="flex items-center gap-3 bg-muted/30 rounded-xl p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={decreaseBrightness}
                          disabled={brightness <= 20}
                          className="h-10 w-10 p-0 rounded-full"
                        >
                          <Minus className="h-5 w-5" />
                        </Button>
                        <div className="flex-1 text-center flex items-center justify-center gap-2">
                          <Lightbulb className="h-5 w-5" />
                          <span className="text-lg font-semibold">
                            {brightness}%
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={increaseBrightness}
                          disabled={brightness >= 150}
                          className="h-10 w-10 p-0 rounded-full"
                        >
                          <Plus className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>

                    {/* Search and Table of Contents */}
                    <div className="col-span-2 pt-2 space-y-4">
                      <PdfSearch
                        file={file}
                        numPages={numPages}
                        onGoToPage={goToPage}
                        currentPage={currentPage}
                      />
                      <PdfToc
                        currentPage={currentPage}
                        file={file}
                        goToPage={goToPage}
                        numPages={numPages}
                        rotation={rotation}
                      />
                    </div>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            {/* Desktop controls - always visible on larger screens */}
            <div className="hidden md:flex items-center gap-2">
              <PdfSearch
                file={file}
                numPages={numPages}
                onGoToPage={goToPage}
                currentPage={currentPage}
              />

              <PdfToc
                currentPage={currentPage}
                file={file}
                goToPage={goToPage}
                numPages={numPages}
                rotation={rotation}
              />

              <Separator orientation="vertical" className="h-6" />

              <Button
                variant="ghost"
                size="sm"
                onClick={cycleReadingMode}
                className="h-8 w-8 p-0"
                title={getReadingModeTitle()}
              >
                {getReadingModeIcon()}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleViewMode}
                className="h-8 w-8 p-0"
                title={viewMode === "single" ? "Grid View" : "Single Page View"}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-6" />

              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={zoomOut}
                  disabled={scale <= 0.5}
                  className="h-6 w-6 p-0"
                >
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <span className="text-xs font-medium px-1 min-w-[3rem] text-center">
                  {Math.round(responsiveScale * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={zoomIn}
                  disabled={scale >= 3}
                  className="h-6 w-6 p-0"
                >
                  <ZoomIn className="h-3 w-3" />
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={rotate}
                className="h-8 w-8 p-0"
                title="Rotate PDF"
              >
                <RotateCw className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-6" />

              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={decreaseBrightness}
                  disabled={brightness <= 20}
                  className="h-6 w-6 p-0"
                  title="Decrease brightness"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex items-center gap-1 px-1">
                  <Lightbulb className="h-3 w-3" />
                  <span className="text-xs font-medium min-w-[2.5rem] text-center">
                    {brightness}%
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={increaseBrightness}
                  disabled={brightness >= 150}
                  className="h-6 w-6 p-0"
                  title="Increase brightness"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <Separator orientation="vertical" className="h-6" />

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="h-8 w-8 p-0"
                title={
                  theme === "dark"
                    ? "Switch to Light Mode"
                    : "Switch to Dark Mode"
                }
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 w-full overflow-auto">
        <div className="min-h-full w-full">
          {viewMode === "single" ? (
            // Single Page or Scroll Views
            readingMode === "page" ? (
              // Page Mode - Single page at a time
              <div className="flex justify-center p-2 sm:p-4 md:p-6 min-w-fit">
                <div className="relative flex justify-center">
                  <Document
                    file={file}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    }
                    className="shadow-lg"
                  >
                    <div
                      className="relative"
                      style={{
                        filter: `brightness(${brightness}%)`,
                      }}
                    >
                      <Page
                        pageNumber={currentPage}
                        scale={responsiveScale}
                        rotate={rotation}
                        loading={
                          <div className="flex items-center justify-center p-8 bg-muted/20 rounded-lg">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          </div>
                        }
                        className="shadow-lg border rounded-lg"
                      />
                    </div>
                  </Document>
                </div>
              </div>
            ) : (
              // Vertical Scroll Mode - All pages in a vertical column
              <div className="flex justify-center p-2 sm:p-4 md:p-6 min-w-fit">
                <div className="space-y-2 sm:space-y-4 flex flex-col items-center">
                  <Document
                    file={file}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    }
                  >
                    <div
                      style={{
                        filter: `brightness(${brightness}%)`,
                      }}
                    >
                      {numPages &&
                        Array.from({ length: numPages }, (_, i) => i + 1).map(
                          (pageNum) => (
                            <div
                              key={pageNum}
                              id={`page-${pageNum}`}
                              className="relative"
                            >
                              <Page
                                pageNumber={pageNum}
                                scale={responsiveScale}
                                rotate={rotation}
                                loading={
                                  <div className="flex items-center justify-center p-8 bg-muted/20 rounded-lg">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                  </div>
                                }
                                className="shadow-lg border rounded-lg mb-2 sm:mb-4"
                              />
                              <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                Page {pageNum}
                              </div>
                            </div>
                          )
                        )}
                    </div>
                  </Document>
                </div>
              </div>
            )
          ) : (
            // Grid View - All Pages
            <div className="p-2 sm:p-4 md:p-6 min-w-fit">
              <Document
                file={file}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                }
              >
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2 sm:gap-3 md:gap-4 justify-items-center"
                  style={{
                    filter: `brightness(${brightness}%)`,
                  }}
                >
                  {numPages &&
                    Array.from({ length: numPages }, (_, i) => i + 1).map(
                      (pageNum) => {
                        // Calculate grid thumbnail scale based on viewport
                        const getGridScale = () => {
                          if (typeof window === "undefined") return 0.3;
                          const viewportWidth = window.innerWidth;
                          if (viewportWidth <= 480) return 0.15; // Mobile
                          if (viewportWidth <= 768) return 0.2; // Tablet
                          if (viewportWidth <= 1024) return 0.25; // Small laptop
                          return 0.3; // Desktop
                        };

                        return (
                          <div
                            key={pageNum}
                            className={`relative cursor-pointer transition-all duration-200 hover:scale-105 ${
                              currentPage === pageNum
                                ? "ring-2 ring-primary ring-offset-2 shadow-lg"
                                : "hover:shadow-md"
                            }`}
                            onClick={() => goToPage(pageNum)}
                          >
                            <div className="relative">
                              <Page
                                pageNumber={pageNum}
                                scale={getGridScale()}
                                rotate={rotation}
                                loading={
                                  <div className="flex items-center justify-center p-2 sm:p-4 bg-muted/20 rounded-lg">
                                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin text-primary" />
                                  </div>
                                }
                                className="shadow border rounded-lg"
                              />
                              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                                {pageNum}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                </div>
              </Document>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BasicPdfRender;
