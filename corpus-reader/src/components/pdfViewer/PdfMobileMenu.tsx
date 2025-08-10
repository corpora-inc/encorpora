import { Grid3X3, Lightbulb, Menu, Minus, Plus, RotateCw, ZoomIn, ZoomOut, ScrollText, ArrowUpDown, Sun, Moon } from "lucide-react"
import { Button } from "../ui/button"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "../ui/drawer"
import { useTheme } from "../ThemeProvider"

interface PdfMobileMenuProps {
    brightness: number
    scale: number
    responsiveScale: number
    readingMode: "page" | "vertical"
    viewMode: "single" | "grid"
    zoomIn: () => void
    zoomOut: () => void
    increaseBrightness: () => void
    decreaseBrightness: () => void
    rotate: () => void
    toggleViewMode: () => void
    cycleReadingMode: () => void
    toggleTheme: () => void
}

const PdfMobileMenu = ({
    brightness,
    scale,
    responsiveScale,
    readingMode,
    viewMode,
    zoomIn,
    zoomOut,
    increaseBrightness,
    decreaseBrightness,
    rotate,
    toggleViewMode,
    cycleReadingMode,
    toggleTheme
}: PdfMobileMenuProps) => {
    const { theme } = useTheme()

    const getReadingModeIcon = () => {
        switch (readingMode) {
            case "page":
                return <ScrollText className="h-4 w-4" />
            case "vertical":
                return <ArrowUpDown className="h-4 w-4" />
        }
    }

    return (
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
                            <div className="flex items-center gap-3 bg-muted/30 rounded-xl p-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={zoomOut}
                                    disabled={scale <= 0.5}
                                    className="h-10 w-10 p-0 rounded-lg"
                                >
                                    <ZoomOut className="h-5 w-5" />
                                </Button>
                                <div className="flex-1 text-center">
                                    <span className="text-md font-semibold">
                                        {Math.round(responsiveScale * 100)}%
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={zoomIn}
                                    disabled={scale >= 3}
                                    className="h-10 w-10 p-0 rounded-lg"
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
                            <div className="flex items-center gap-3 bg-muted/30 rounded-xl p-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={decreaseBrightness}
                                    disabled={brightness <= 20}
                                    className="h-10 w-10 p-0 rounded-lg"
                                >
                                    <Minus className="h-5 w-5" />
                                </Button>
                                <div className="flex-1 text-center flex items-center justify-center gap-2">
                                    <Lightbulb className="h-5 w-5" />
                                    <span className="text-md font-semibold">
                                        {brightness}%
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={increaseBrightness}
                                    disabled={brightness >= 100}
                                    className="h-10 w-10 p-0 rounded-lg"
                                >
                                    <Plus className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default PdfMobileMenu