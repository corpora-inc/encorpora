import { useState } from "react";
import { 
    History as HistoryIcon, 
    Bookmark as BookmarkIcon, 
    BookmarkPlus as BookmarkPlusIcon,
    BookmarkMinus as BookmarkMinusIcon,
    Trash2 as TrashIcon,
    Calendar as CalendarIcon
} from "lucide-react";

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { useHistoryStore, type EntryOut } from "@/store/history";
import { useBookmarkStore } from "@/store/bookmarks";
import { useSettingsStore } from "@/store/settings";
import { isRTL } from "@/util/convert";

interface HistorySheetProps {
    children: React.ReactNode;
}

export function HistorySheet({ children }: HistorySheetProps) {
    const [open, setOpen] = useState(false);
    
    const history = useHistoryStore((s) => s.history);
    const setIndex = useHistoryStore((s) => s.setIndex);
    const clearHistory = useHistoryStore((s) => s.clear);
    
    const bookmarks = useBookmarkStore((s) => s.bookmarks);
    const addBookmark = useBookmarkStore((s) => s.addBookmark);
    const removeBookmark = useBookmarkStore((s) => s.removeBookmark);
    const isBookmarked = useBookmarkStore((s) => s.isBookmarked);
    const clearBookmarks = useBookmarkStore((s) => s.clear);
    
    const primaryLang = useSettingsStore((s) => s.primaryLang);
    const showRomanization = useSettingsStore((s) => s.showRomanization);

    const handleEntryClick = (entry: EntryOut) => {
        const index = history.findIndex(h => h.entry_id === entry.entry_id);
        if (index !== -1) {
            setIndex(index);
            setOpen(false);
        }
    };

    const toggleBookmark = (entry: EntryOut) => {
        if (isBookmarked(entry.entry_id)) {
            removeBookmark(entry.entry_id);
        } else {
            addBookmark(entry);
        }
    };

    const renderEntry = (entry: EntryOut, showBookmarkButton = true) => {
        const textByLang: Record<string, string> = {};
        const romanizationByLang: Record<string, string | undefined> = {};
        
        entry.translations.forEach((t) => {
            textByLang[t.language_code] = t.text;
            romanizationByLang[t.language_code] = t.romanization;
        });
        textByLang["en"] = entry.en_text;

        return (
            <Card key={entry.entry_id} className="mb-3">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Entry #{entry.entry_id}
                            </CardTitle>
                            <div className="flex flex-wrap gap-1 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                    {entry.level}
                                </Badge>
                                {entry.domains.map((domain) => (
                                    <Badge key={domain} variant="outline" className="text-xs">
                                        {domain}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                        {showBookmarkButton && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleBookmark(entry);
                                }}
                                className="h-8 w-8 p-0"
                            >
                                {isBookmarked(entry.entry_id) ? (
                                    <BookmarkMinusIcon className="h-4 w-4" />
                                ) : (
                                    <BookmarkPlusIcon className="h-4 w-4" />
                                )}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent 
                    className="pt-0 cursor-pointer" 
                    onClick={() => handleEntryClick(entry)}
                >
                    {/* Only show primary language */}
                    {(() => {
                        const primaryLanguage = primaryLang();
                        const text = textByLang[primaryLanguage];
                        const romanization = romanizationByLang[primaryLanguage];
                        const isRTLText = isRTL(primaryLanguage);
                        
                        if (!text) return (
                            <div className="text-center text-muted-foreground py-2">
                                No text available
                            </div>
                        );
                        
                        return (
                            <div>
                                <div 
                                    className={`text-base font-medium ${isRTLText ? 'text-right' : 'text-left'}`}
                                    dir={isRTLText ? 'rtl' : 'ltr'}
                                >
                                    {text}
                                </div>
                                {showRomanization && romanization && (
                                    <div className="text-sm text-muted-foreground mt-1">
                                        {romanization}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </CardContent>
            </Card>
        );
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {children}
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <HistoryIcon className="h-5 w-5" />
                        History & Bookmarks
                    </SheetTitle>
                    <SheetDescription>
                        View your sentence history and bookmarks
                    </SheetDescription>
                </SheetHeader>
                
                <Tabs defaultValue="history" className="mt-6">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="history" className="flex items-center gap-2">
                            <HistoryIcon className="h-4 w-4" />
                            History ({history.length})
                        </TabsTrigger>
                        <TabsTrigger value="bookmarks" className="flex items-center gap-2">
                            <BookmarkIcon className="h-4 w-4" />
                            Bookmarks ({bookmarks.length})
                        </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="history" className="mt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium">
                                Recent Sentences
                            </h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearHistory}
                                disabled={history.length === 0}
                                className="h-8 text-xs"
                            >
                                <TrashIcon className="h-4 w-4 mr-1" />
                                Clear
                            </Button>
                        </div>
                        
                        <div className="space-y-3 overflow-y-scroll h-screen">
                            {history.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">
                                    <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No history yet</p>
                                </div>
                            ) : (
                                [...history].reverse().map((entry) => renderEntry(entry, true))
                            )}
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="bookmarks" className="mt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium">
                                Saved Sentences
                            </h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearBookmarks}
                                disabled={bookmarks.length === 0}
                                className="h-8 text-xs"
                            >
                                <TrashIcon className="h-4 w-4 mr-1" />
                                Clear
                            </Button>
                        </div>
                        
                        <div className="space-y-3 overflow-y-scroll h-screen">
                            {bookmarks.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">
                                    <BookmarkIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No bookmarks yet</p>
                                    <p className="text-xs mt-1">Tap the bookmark icon to save sentences</p>
                                </div>
                            ) : (
                                bookmarks.map((entry) => renderEntry(entry, false))
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}