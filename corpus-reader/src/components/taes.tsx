import {
    readFileSrc,
    updateBookProgress,
    getBookInformation,
    BookEntry,
} from "@/lib/utils";
import { useEffect, useState, useCallback, useRef } from "react";
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

    // Zustand store for persistent settings
    const {
        settings,
        setScale,
        setRotation,
        setViewMode,
        setReadingMode,
        setBrightness,
    } = usePdfViewerStore();

    // Local state
    const [numPages, setNumPages] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [file, setFile] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [bookInfo, setBookInfo] = useState<BookEntry | null>(null);
    const [controlsVisible, setControlsVisible] = useState(true); // State to manage header/footer visibility

    // Refs
    const lastSavedPageRef = useRef<number>(1);
    const hideControlsTimeout = useRef<NodeJS.Timeout>();
    const currentPageRef = useRef(currentPage); // Ref to track current page for observer

    // Extract settings from store for easier access
    const { scale, rotation, viewMode, readingMode, brightness } = settings;

    // Update ref whenever currentPage state changes
    useEffect(() => {
        currentPageRef.current = currentPage;
    }, [currentPage]);

    // --- NEW: Logic for showing and hiding controls ---
    const showControls = useCallback(() => {
        setControlsVisible(true);
        if (hideControlsTimeout.current) {
            clearTimeout(hideControlsTimeout.current);
        }
        // Automatically hide controls after 3 seconds of inactivity
        hideControlsTimeout.current = setTimeout(() => {
            setControlsVisible(false);
        }, 3000);
    }, []);

    const toggleControls = () => {
        setControlsVisible((prev) => {
            const isNowVisible = !prev;
            if (isNowVisible) {
                showControls(); // Show and start the auto-hide timer
            } else {
                // Hide immediately and clear any existing timer
                if (hideControlsTimeout.current) {
                    clearTimeout(hideControlsTimeout.current);
                }
            }
            return isNowVisible;
        });
    };

    const handleControlsHover = () => {
        // When mouse is over the controls, prevent them from hiding
        if (hideControlsTimeout.current) {
            clearTimeout(hideControlsTimeout.current);
        }
    };

    // Initial show controls on mount
    useEffect(() => {
        showControls();
        return () => {
            if (hideControlsTimeout.current) {
                clearTimeout(hideControlsTimeout.current);
            }
        };
    }, [showControls]);
    // --- END NEW LOGIC ---

    // Load book information and restore last read page
    useEffect(() => {
        if (!bookPath) return;
        const loadBookInfo = async () => {
            try {
                const info = await getBookInformation(bookPath);
                if (info) {
                    setBookInfo(info);
                    if (info.last_read_page && info.last_read_page > 0) {
                        setCurrentPage(info.last_read_page);
                        lastSavedPageRef.current = info.last_read_page;
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
        if (!bookPath) return;

        setLoading(true);
        setError(null);

        const timeoutId = setTimeout(() => {
            setError("PDF loading timed out.");
            setLoading(false);
        }, 15000);

        readFileSrc(bookPath)
            .then((fileData) => {
                setFile(fileData);
                setLoading(false);
                clearTimeout(timeoutId);
            })
            .catch((err) => {
                setError(`Failed to load PDF file: ${err.message}`);
                setLoading(false);
                clearTimeout(timeoutId);
            });

        return () => clearTimeout(timeoutId);
    }, [bookPath]);

    // Update progress (debounced)
    useEffect(() => {
        if (!bookPath || !numPages || currentPage === lastSavedPageRef.current) {
            return;
        }
        const timeoutId = setTimeout(async () => {
            const progress = Math.round((currentPage / numPages) * 100);
            await updateBookProgress(bookPath, currentPage, progress);
            lastSavedPageRef.current = currentPage;
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [currentPage, numPages, bookPath]);

    // --- FIXED: Intersection Observer for vertical scroll mode ---
    useEffect(() => {
        if (readingMode !== "vertical" || !numPages) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visiblePages = entries
                    .filter((e) => e.isIntersecting)
                    .map((e) => ({
                        num: parseInt(e.target.id.replace("page-", ""), 10),
                        ratio: e.intersectionRatio,
                    }));

                if (visiblePages.length > 0) {
                    const mostVisible = visiblePages.reduce((prev, curr) =>
                        prev.ratio > curr.ratio ? prev : curr
                    );
                    // Compare with the ref value to avoid a dependency loop
                    if (mostVisible.num !== currentPageRef.current) {
                        setCurrentPage(mostVisible.num);
                    }
                }
            },
            {
                threshold: [0.1, 0.25, 0.5, 0.75, 0.9], // Trigger at various visibility points
            }
        );

        const pageElements = document.querySelectorAll('[id^="page-"]');
        pageElements.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, [readingMode, numPages, file]); // Removed currentPage, added file to re-trigger on new doc

    // Scroll to saved page when switching to vertical mode
    useEffect(() => {
        if (readingMode === "vertical" && currentPage > 1) {
            const timeoutId = setTimeout(() => {
                const pageElement = document.getElementById(`page-${currentPage}`);
                if (pageElement) {
                    pageElement.scrollIntoView({ behavior: "auto", block: "start" });
                }
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [readingMode, file]); // Trigger only when mode changes or file loads

    const onDocumentLoadSuccess = useCallback(
        ({ numPages }: DocumentLoadSuccess) => {
            setNumPages(numPages);
            setLoading(false);
        },
        []
    );

    const onDocumentLoadError = useCallback((err: Error) => {
        setError(`Failed to load PDF: ${err.message}`);
        setLoading(false);
    }, []);

    const goToPage = (pageNumber: number) => {
        setCurrentPage(pageNumber);
        if (readingMode === "vertical") {
            const pageElement = document.getElementById(`page-${pageNumber}`);
            pageElement?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
            setViewMode("single");
        }
        showControls(); // Show controls when jumping to a page
    };

    // Handlers for controls
    const goToPrevPage = () => setCurrentPage((prev) => Math.max(1, prev - 1));
    const goToNextPage = () => setCurrentPage((prev) => Math.min(numPages || 1, prev + 1));
    const zoomIn = () => setScale(scale + 0.2);
    const zoomOut = () => setScale(scale - 0.2);
    const rotate = () => setRotation(rotation + 90);
    const toggleViewMode = () => setViewMode(viewMode === "single" ? "grid" : "single");
    const cycleReadingMode = () => setReadingMode(readingMode === "page" ? "vertical" : "page");
    const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
    const increaseBrightness = () => setBrightness(brightness + 10);
    const decreaseBrightness = () => setBrightness(brightness - 10);

    // Icons and titles for UI
    const getReadingModeIcon = () => readingMode === "page" ? <ScrollText className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4" />;
    const getReadingModeTitle = () => readingMode === "page" ? "Page Mode - Click for Vertical Scroll" : "Vertical Scroll - Click for Page Mode";

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Card className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" /><h3 className="text-lg font-semibold">Loading PDF...</h3></Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Card className="p-8 text-center max-w-md"><AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" /><h3 className="text-lg font-semibold">Error Loading PDF</h3><p className="text-muted-foreground mb-4">{error}</p><Button onClick={() => window.location.reload()} variant="outline">Try Again</Button></Card>
            </div>
        );
    }

    return (
        <div
            className="flex flex-col h-screen bg-background overflow-hidden"
            // Show controls when mouse is near the top of the screen
            onMouseMove={(e) => {
                if (e.clientY < 80) {
                    showControls();
                }
            }}
        >
            {/* --- REVISED: Auto-hiding Header --- */}
            <div
                className={`border-b bg-card/50 backdrop-blur-sm fixed top-0 left-0 right-0 z-20 transition-transform duration-300 ease-in-out ${controlsVisible ? "transform-none" : "-translate-y-full"
                    }`}
                onMouseEnter={handleControlsHover}
                onMouseLeave={showControls}
            >
                <div className="flex items-center justify-between p-3 md:p-4">
                    <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
                        <Button variant="ghost" size="icon" onClick={() => window.history.back()} aria-label="Back"><ArrowLeft className="w-4 h-4 md:w-5 md:h-5" /></Button>
                        <div className="flex items-center gap-1 md:gap-2 min-w-0">
                            <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
                            <span className="font-medium text-sm md:text-base truncate">{bookInfo?.title}</span>
                        </div>
                        {numPages && <Badge variant="secondary" className="hidden sm:inline-flex text-xs">{numPages} pages</Badge>}
                    </div>

                    <div className="flex items-center gap-1 md:gap-2 shrink-0">
                        {/* Desktop controls */}
                        <div className="hidden md:flex items-center gap-2">
                            <PdfSearch file={file} numPages={numPages} onGoToPage={goToPage} currentPage={currentPage} />
                            <PdfToc currentPage={currentPage} file={file} goToPage={goToPage} numPages={numPages} rotation={rotation} />
                            <Separator orientation="vertical" className="h-6" />
                            <Button variant="ghost" size="sm" onClick={cycleReadingMode} className="h-8 w-8 p-0" title={getReadingModeTitle()}>{getReadingModeIcon()}</Button>
                            <Button variant="ghost" size="sm" onClick={toggleViewMode} className="h-8 w-8 p-0" title={viewMode === "single" ? "Grid View" : "Single Page View"}><Grid3X3 className="h-4 w-4" /></Button>
                            <Separator orientation="vertical" className="h-6" />
                            <div className="flex items-center gap-1 border rounded-lg p-1">
                                <Button variant="ghost" size="sm" onClick={zoomOut} disabled={scale <= 0.5} className="h-6 w-6 p-0"><ZoomOut className="h-3 w-3" /></Button>
                                <span className="text-xs font-medium px-1 min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
                                <Button variant="ghost" size="sm" onClick={zoomIn} disabled={scale >= 3} className="h-6 w-6 p-0"><ZoomIn className="h-3 w-3" /></Button>
                            </div>
                            <Button variant="ghost" size="sm" onClick={rotate} className="h-8 w-8 p-0" title="Rotate PDF"><RotateCw className="h-4 w-4" /></Button>
                            <Separator orientation="vertical" className="h-6" />
                            <div className="flex items-center gap-1 border rounded-lg p-1">
                                <Button variant="ghost" size="sm" onClick={decreaseBrightness} disabled={brightness <= 20} className="h-6 w-6 p-0"><Minus className="h-3 w-3" /></Button>
                                <div className="flex items-center gap-1 px-1"><Lightbulb className="h-3 w-3" /><span className="text-xs font-medium">{brightness}%</span></div>
                                <Button variant="ghost" size="sm" onClick={increaseBrightness} disabled={brightness >= 150} className="h-6 w-6 p-0"><Plus className="h-3 w-3" /></Button>
                            </div>
                            <Separator orientation="vertical" className="h-6" />
                            <Button variant="ghost" size="sm" onClick={toggleTheme} className="h-8 w-8 p-0" title={theme === "dark" ? "Light Mode" : "Dark Mode"}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
                        </div>
                        {/* Mobile drawer toggle */}
                        <Drawer>
                            <DrawerTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0 md:hidden"><Menu className="h-4 w-4" /></Button></DrawerTrigger>
                            <DrawerContent>{/* ... Your existing drawer content ... */}</DrawerContent>
                        </Drawer>
                    </div>
                </div>
            </div>

            {/* --- REVISED: Main content area to toggle controls --- */}
            <div className="flex-1 w-full h-full cursor-pointer" onClick={toggleControls}>
                <ScrollArea
                    className="flex-1 pt-[56px] md:pt-[64px]"

                >
                    {viewMode === "single" ? (
                        // Single Page or Scroll Views
                        readingMode === "page" ? (
                            // Page Mode - Single page at a time
                            <div className="flex justify-center p-6">
                                <div className="max-w-full relative">
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
                                                scale={scale}
                                                rotate={rotation}
                                                loading={
                                                    <div className="flex items-center justify-center p-8 bg-muted/20 rounded-lg">
                                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                    </div>
                                                }
                                                className="shadow-lg border rounded-lg overflow-hidden"
                                            />
                                        </div>
                                    </Document>
                                </div>
                            </div>
                        ) : (
                            // Vertical Scroll Mode - All pages in a vertical column
                            <div className="flex justify-center p-6">
                                <div className="max-w-full space-y-4">
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
                                                                scale={scale}
                                                                rotate={rotation}
                                                                loading={
                                                                    <div className="flex items-center justify-center p-8 bg-muted/20 rounded-lg">
                                                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                                    </div>
                                                                }
                                                                className="shadow-lg border rounded-lg overflow-hidden mb-4"
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
                        <div className="p-6">
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
                                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
                                    style={{
                                        filter: `brightness(${brightness}%)`,
                                    }}
                                >
                                    {numPages &&
                                        Array.from({ length: numPages }, (_, i) => i + 1).map(
                                            (pageNum) => (
                                                <div
                                                    key={pageNum}
                                                    className={`max-w-fit relative cursor-pointer transition-all duration-200 hover:scale-105 ${currentPage === pageNum
                                                        ? "ring-2 ring-primary ring-offset-2 shadow-lg"
                                                        : "hover:shadow-md"
                                                        }`}
                                                    onClick={() => goToPage(pageNum)}
                                                >
                                                    <div className="relative">
                                                        <Page
                                                            pageNumber={pageNum}
                                                            scale={0.3}
                                                            rotate={rotation}
                                                            loading={
                                                                <div className="flex items-center justify-center p-4 bg-muted/20 rounded-lg">
                                                                    <Loader2 className="h-4 w-4 animate-spin text-primary max-w-fit" />
                                                                </div>
                                                            }
                                                            className="shadow border rounded-lg overflow-hidden"
                                                        />
                                                        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                                            {pageNum}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        )}
                                </div>
                            </Document>
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* --- NEW: Auto-hiding Footer for navigation --- */}
            {numPages && (
                <div
                    className={`bg-card/50 backdrop-blur-sm fixed bottom-0 left-0 right-0 z-20 transition-transform duration-300 ease-in-out ${controlsVisible ? "transform-none" : "translate-y-full"
                        }`}
                    onMouseEnter={handleControlsHover}
                    onMouseLeave={showControls}
                >
                    <div className="flex items-center justify-center gap-2 md:gap-4 p-3">
                        <Button variant="outline" size="sm" onClick={goToPrevPage} disabled={currentPage <= 1} className="h-9 px-3"><ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline ml-1">Prev</span></Button>
                        <div className="flex flex-col items-center flex-grow max-w-xs">
                            <span className="text-sm font-medium whitespace-nowrap">{currentPage} / {numPages}</span>
                            <Progress value={(currentPage / numPages) * 100} className="h-1.5 mt-1" />
                        </div>
                        <Button variant="outline" size="sm" onClick={goToNextPage} disabled={currentPage >= numPages} className="h-9 px-3"><span className="hidden sm:inline mr-1">Next</span><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BasicPdfRender;