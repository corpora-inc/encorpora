import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    ChevronLeft as ChevronLeftIcon,
    RefreshCw as RefreshIcon,
    ChevronRight as ChevronRightIcon,
    Speaker,
    AudioLines,
    Ear,
    Bookmark as BookmarkIcon,
    BookmarkCheck as BookmarkCheckIcon,
    History as HistoryIcon,
    Settings as SettingsIcon,
    MoreHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings";
import { EntryOut, useHistoryStore } from "@/store/history";
import { useBookmarkStore } from "@/store/bookmarks";
import { HistorySheet } from "@/components/HistorySheet";
import { SettingsModal } from "@/components/SettingsModal";
import { createVoiceTTS } from "@/util/speak";
import { useTranslation } from "react-i18next";

import { isRTL, toCamelCase } from "@/util/convert";
import {
    getPlatformBottomPadding,
    getPlatformTopPaddingButtons,
    getPlatformTopPaddingTranslations,
    isAndroid,
} from "@/util/browser";



export function MainExperience() {
    // Settings (active stack)
    const activeStackId = useSettingsStore((s) => s.activeStackId);
    const languages = useSettingsStore((s) => s.languages);
    const domains = useSettingsStore((s) => s.domains);
    const levels = useSettingsStore((s) => s.levels);
    const rate = useSettingsStore((s) => s.rate);
    const showRomanization = useSettingsStore((s) => s.showRomanization);
    const { t } = useTranslation();

    // Active stack history
    const activeHistory = useHistoryStore((s) => s.byStack[activeStackId]);
    const ids = activeHistory?.ids ?? [];
    const index = activeHistory?.index ?? -1;

    const pushEntry = useHistoryStore((s) => s.pushEntry);
    const setIndex = useHistoryStore((s) => s.setIndex);

    // Bookmark functionality
    const addBookmark = useBookmarkStore((s) => s.addBookmark);
    const removeBookmark = useBookmarkStore((s) => s.removeBookmark);
    const bookmarks = useBookmarkStore((s) => s.byStack[activeStackId] ?? []);
    const [currEntry, setCurrEntry] = useState<EntryOut | null>(null);
    const fetchSeqRef = useRef(0);

    // Create a derived bookmark check that uses the bookmarks array directly
    const isCurrentBookmarked = useMemo(() => {
        return currEntry ? bookmarks.some(b => b.entry_id === currEntry.entry_id) : false;
    }, [bookmarks, currEntry]);

    // Dog-ear action bank state
    const [showActionBank, setShowActionBank] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const actionBankRef = useRef<HTMLDivElement>(null);

    const displayedLanguages = useMemo(() => [...languages].reverse(), [languages]);

    // --- Bookmark handlers ----------------------------------------------------

    const toggleBookmark = useCallback(() => {
        if (!currEntry) return;

        if (isCurrentBookmarked) {
            removeBookmark(currEntry.entry_id);
        } else {
            addBookmark(currEntry);
        }

    }, [currEntry, isCurrentBookmarked, addBookmark, removeBookmark]);

    // --- DB fetchers -----------------------------------------------------------

    const resolveCurrent = useCallback(async (entry_id: number) => {
        // console.log("resolving", entry_id);
        const mySeq = ++fetchSeqRef.current;
        const entry = await invoke<EntryOut>("get_entry_by_id_with_translations", { entryId: entry_id })
        // console.log("resolved", entry_id, entry);
        if (entry && mySeq === fetchSeqRef.current) setCurrEntry(entry);
    }, []);

    const fetchRandomEntry = useCallback(async () => {
        const entry = await invoke<EntryOut>("get_random_entry_with_translations", {
            levels,
            domains,
        })
        if (!entry) return;

        // push id to history and show immediately (we already have the full entry)
        pushEntry(entry.entry_id);
        setCurrEntry(entry);
    }, [levels, domains, pushEntry]);

    // --- Effects ---------------------------------------------------------------

    // On stack switch: clear view, then either load existing selection or fetch one
    useEffect(() => {
        setCurrEntry(null);
        if (ids.length === 0) {
            void fetchRandomEntry();
        } else if (index >= 0) {
            void resolveCurrent(ids[index]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeStackId]);

    // Re-fetch same entry when language list changes (always fetch all translations,
    // but we re-resolve to ensure fresh data & mapping)
    useEffect(() => {
        if (index >= 0 && index < ids.length) {
            void resolveCurrent(ids[index]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [languages]);

    // Close action bank on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionBankRef.current && !actionBankRef.current.contains(event.target as Node)) {
                setShowActionBank(false);
            }
        };
        if (!showActionBank) return;

        if (showActionBank) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showActionBank]);

    // --- Nav handlers (deterministic: compute id, set index, resolve now) ------

    const handlePrev = () => {
        if (index <= 0) return;
        const target = ids[index - 1];
        if (typeof target !== "number") return;
        setIndex(index - 1);
        void resolveCurrent(target);
    };

    const handleNext = () => {
        // if we have a forward item, go to it
        if (index < ids.length - 1) {
            const target = ids[index + 1];
            if (typeof target !== "number") return;
            setIndex(index + 1);
            void resolveCurrent(target);
            return;
        }
        // else fetch a new random
        void fetchRandomEntry();
    };

    // keep the gentle scroll on index change (purely visual)
    const scrollRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        setTimeout(() => {
            scrollRef.current?.scrollTo({ top: -200, behavior: "smooth" });
        }, 33);
    }, [index]);

    // --- Render helpers --------------------------------------------------------

    const textByDbCode: Record<string, string> = {};
    const romByDbCode: Record<string, string | undefined> = {};
    if (currEntry) {
        for (const tItem of currEntry.translations) {
            textByDbCode[tItem.language_code] = tItem.text;
            romByDbCode[tItem.language_code] = tItem.romanization;
        }
        textByDbCode["en"] = currEntry.en_text;
    }

    const textFor = (uiCode: string) =>
        textByDbCode[uiCode] ?? textByDbCode[uiCode.split("-")[0]] ?? "";
    const romanizationFor = (uiCode: string) =>
        romByDbCode[uiCode] ?? romByDbCode[uiCode.split("-")[0]];

    // --- UI --------------------------------------------------------------------

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full items-center relative">
            {/* Floating domain/level chips */}
            {currEntry && (
                <div
                    className="fixed top-5 pt-safe left-5 z-50 pointer-events-none flex"
                    style={{ background: "transparent", marginTop: getPlatformTopPaddingButtons() }}
                >


                    <div className="flex flex-wrap gap-1 items-center justify-center text-gray-400 text-xs mb-1">
                        <span className="px-2 py-0.5 rounded-md border border-gray-200 bg-gray-50 text-xs">
                            {currEntry.level.toUpperCase()}
                        </span>
                        {currEntry.domains.map((d) => (
                            <span key={d} className="px-2 py-0.5 rounded-md border border-gray-200 bg-gray-50 text-xs">
                                {t(`categories.${d}` as any) || d}
                            </span>
                        ))}
                    </div>

                </div>
            )}

            {/* Scrollable Translations */}
            <div
                className="flex-1 w-full overflow-y-auto min-h-0 px-2 pt-20 flex flex-col"
                ref={scrollRef}
                style={{
                    paddingBottom: `${getPlatformBottomPadding()}px`,
                    paddingTop: `${getPlatformTopPaddingTranslations()}px`,
                }}
            >
                <div key={index} className="w-full max-w-4xl mx-auto flex flex-col items-center gap-y-9 my-auto">
                    {displayedLanguages.map((uiCode, idx) => {
                        const txt = textFor(uiCode);
                        const rom = romanizationFor(uiCode);
                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                transition={{ duration: 0.28, delay: idx * 0.04, ease: "easeOut" }}
                                className="w-full flex flex-col items-center"
                            >
                                <div
                                    className="text-center"
                                    style={{ cursor: "pointer" }}
                                    onClick={() => {
                                        // TODO: this is just a hack for our
                                        // preferences for right now but
                                        // very soon we should do a full,
                                        // proper, voice introspection and
                                        // choice and also ... ya' know,
                                        // narrators and stuff.
                                        if (uiCode === "en") {
                                            uiCode = "en-US";
                                        }
                                        if (uiCode === "es") {
                                            uiCode = "es-MX";
                                        }
                                        if (uiCode === "zh-Hant") {
                                            uiCode = "zh-TW";
                                            // uiCode = "zh-HK";
                                        }
                                        if (uiCode === "zh-Hans") {
                                            uiCode = "zh-CN";
                                        }
                                        // if (uiCode === "fr") {
                                        //     uiCode = "fr-FR";
                                        // }
                                        createVoiceTTS(uiCode)(txt, rate);
                                    }}
                                >
                                    <div className="text-xs text-gray-400">
                                        {t(`languages.${toCamelCase(uiCode)}` as any) || uiCode}
                                    </div>
                                    <div
                                        className="text-center text-xl md:text-2xl lg:text-3xl my-1"
                                        style={{ wordBreak: "break-word", maxWidth: "80vw", lineHeight: 1.1 }}
                                        dir={isRTL(uiCode) ? "rtl" : "ltr"}
                                    >
                                        {txt || <span className="opacity-30">—</span>}
                                    </div>
                                    {showRomanization && rom && (
                                        <div
                                            className="text-center text-sm text-gray-400 italic mt-1 mb-1 select-text"
                                            style={{ maxWidth: "80vw", wordBreak: "break-word" }}
                                        >
                                            {rom}
                                        </div>
                                    )}

                                    <motion.div whileTap={{ scale: 0.9 }} transition={{ type: "spring", stiffness: 100, damping: 10 }}>
                                        <Button className="mt-1" size="sm" variant="outline" style={{ cursor: "pointer" }}>
                                            <Speaker className="shrink-0" />
                                            <AudioLines className="shrink-0" />
                                            <Ear className="shrink-0" />
                                        </Button>
                                    </motion.div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Floating Nav */}
            <div
                className="fixed bottom-0 left-0 w-full flex justify-center z-50 pointer-events-none"
                style={{ background: "transparent", paddingBottom: getPlatformBottomPadding() / 6 }}
            >
                <div
                    className="flex flex-col gap-1 pointer-events-auto rounded-md shadow-2xl bg-white/95 px-8 py-3 border border-gray-200 items-center min-w-[280px]"
                    style={{ marginBottom: isAndroid() ? "39px" : 0 }}
                >
                    <div className="flex justify-center items-center gap-8">
                        <Button onClick={handlePrev} variant="ghost" size="lg" aria-label="Previous sentence">
                            <ChevronLeftIcon />
                        </Button>
                        <Button onClick={fetchRandomEntry} variant="outline" size="lg" aria-label="Random sentence">
                            <RefreshIcon />
                        </Button>
                        <Button onClick={handleNext} variant="ghost" size="lg" aria-label="Next sentence">
                            <ChevronRightIcon />
                        </Button>
                    </div>

                    <span className="text-xs text-gray-400 mt-1">
                        {Math.max(0, index + 1)}/{ids.length}
                    </span>
                </div>
            </div>

            {/* Action bank - positioned at bottom-right of screen */}
            <div
                className="fixed bottom-0 right-0 z-50 pointer-events-none"
                style={{
                    paddingBottom: getPlatformBottomPadding() / 6 + (isAndroid() ? 39 : 0),
                    paddingRight: "16px"
                }}
            >
                <div className="relative">
                    {/* Action toggle button */}
                    <motion.button
                        className="pointer-events-auto bg-white/95 border border-gray-200 rounded-md w-11 h-11 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
                        onClick={() => setShowActionBank(!showActionBank)}
                        aria-expanded={showActionBank}
                        aria-label={showActionBank ? "Close actions" : "Open actions"}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <motion.div
                            animate={{ rotate: showActionBank ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <MoreHorizontal className="h-5 w-5 text-gray-600" />
                        </motion.div>
                    </motion.button>

                    {/* Expandable action popover */}
                    <AnimatePresence>
                        {showActionBank && (
                            <motion.div
                                ref={actionBankRef}
                                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="absolute bottom-full right-0 mb-2 pointer-events-auto"
                            >
                                <div className="bg-white/95 border border-gray-200 rounded-lg shadow-2xl p-2 min-w-[120px]">
                                    <div className="flex flex-col gap-1">
                                        <Button
                                            onClick={toggleBookmark}
                                            variant="ghost"
                                            size="sm"
                                            aria-label={currEntry && isCurrentBookmarked ? "Remove bookmark" : "Add bookmark"}
                                            disabled={!currEntry}
                                            className="justify-start gap-2 h-8"
                                        >
                                            {currEntry && isCurrentBookmarked ? (
                                                <>
                                                    <BookmarkCheckIcon className="h-4 w-4 text-black" />
                                                    <span className="text-xs">Saved</span>
                                                </>
                                            ) : (
                                                <>
                                                    <BookmarkIcon className="h-4 w-4" />
                                                    <span className="text-xs">Save</span>
                                                </>
                                            )}
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setShowHistory(true);
                                                setShowActionBank(false);
                                            }}

                                            className="justify-start gap-2 h-8"
                                            aria-label="History & Bookmarks"
                                        >
                                            <HistoryIcon className="h-4 w-4" />
                                            <span className="text-xs">History</span>
                                        </Button>


                                        <Button
                                            onClick={
                                                () => {
                                                    setShowSettings(true);
                                                    setShowActionBank(false);
                                                }}
                                            variant="ghost"
                                            size="sm"
                                            className="justify-start gap-2 h-8"
                                            aria-label="Settings"
                                        >
                                            <SettingsIcon className="h-4 w-4" />
                                            <span className="text-xs">Settings</span>
                                        </Button>

                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            <HistorySheet
                open={showHistory}
                onClose={() => setShowHistory(false)}
            />
            <SettingsModal
                open={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </div>
    );
}
