import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    ChevronLeft as ChevronLeftIcon,
    RefreshCw as RefreshIcon,
    ChevronRight as ChevronRightIcon,
    Speaker,
    AudioLines,
    Ear,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings";
import { useHistoryStore } from "@/store/history";
import { useTranslation } from "react-i18next";

import { isRTL, toCamelCase } from "@/util/convert";
import {
    getPlatformBottomPadding,
    getPlatformTopPaddingButtons,
    getPlatformTopPaddingTranslations,
    isAndroid,
} from "@/util/browser";
import { speakWithStackPrefs } from "@/util/speakWithStackPrefs";


type TranslationOut = {
    language_code: string;
    text: string;
    romanization: string;
};
type EntryOut = {
    entry_id: number;
    en_text: string;
    level: string;
    domains: string[];
    translations: TranslationOut[];
};

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

    const [currEntry, setCurrEntry] = useState<EntryOut | null>(null);
    const fetchSeqRef = useRef(0);

    const displayedLanguages = useMemo(() => [...languages].reverse(), [languages]);

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
                    className="fixed top-5 pt-safe left-5 z-50 pointer-events-none"
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
                    // use the inset:
                    // paddingBottom: "env(safe-area-inset-bottom)",
                    // paddingTop: `calc(env(safe-area-inset-top) + 4rem)`,
                }}
            >
                <div key={index} className="w-full max-w-4xl mx-auto flex flex-col items-center gap-y-9 my-auto"
                >
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
                                        speakWithStackPrefs(uiCode, txt, rate);
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
                                            className="text-center text-sm text-base text-gray-400 italic mt-1 mb-1 select-text"
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
        </div>
    );
}
