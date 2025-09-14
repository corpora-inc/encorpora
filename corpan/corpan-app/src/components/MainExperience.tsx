// src/components/MainExperience.tsx
// (update to derive the active stack's slice directly; no mirrors/subscriptions)

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { createVoiceTTS } from "@/util/speak";
import { useTranslation } from "react-i18next";

import { isRTL, toCamelCase } from "@/util/convert";
import {
    getPlatformBottomPadding,
    getPlatformTopPaddingButtons,
    getPlatformTopPaddingTranslations,
    isAndroid,
} from "@/util/browser";

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

    // Derive active history slice directly from canonical store
    const ids = useHistoryStore((s) => s.byStack[activeStackId]?.ids ?? []);
    const index = useHistoryStore((s) => s.byStack[activeStackId]?.index ?? -1);
    const pushEntry = useHistoryStore((s) => s.pushEntry);
    const setIndex = useHistoryStore((s) => s.setIndex);

    // In-memory cache for resolved entries by id
    const cacheRef = useRef<Map<number, EntryOut>>(new Map());
    const [currEntry, setCurrEntry] = useState<EntryOut | null>(null);
    const fetchSeqRef = useRef(0);

    const languageCodes = useMemo(() => [...languages], [languages]);

    const fetchRandomEntry = async () => {
        // keep index pointing to end before pushing new
        setIndex(ids.length - 1);

        const entry = await invoke<EntryOut>("get_random_entry_with_translations", {
            levels,
            domains,
            languageCodes,
            language_codes: languageCodes,
        }).catch(() => null);

        if (!entry) return;
        cacheRef.current.set(entry.entry_id, entry);
        pushEntry(entry.entry_id); // store only the id
    };

    const resolveCurrent = async (entryId: number | undefined) => {
        if (entryId == null) {
            setCurrEntry(null);
            return;
        }
        const mySeq = ++fetchSeqRef.current;

        const cached = cacheRef.current.get(entryId);
        if (cached) {
            setCurrEntry(cached);
            return;
        }

        const entry = await invoke<EntryOut>("get_entry_by_id_with_translations", {
            entryId,
            entry_id: entryId,
            languageCodes,
            language_codes: languageCodes,
        }).catch(() => null);

        if (entry && mySeq === fetchSeqRef.current) {
            cacheRef.current.set(entry.entry_id, entry);
            setCurrEntry(entry);
        }
    };

    // When stack changes, ensure we show something for that stack
    useEffect(() => {
        if ((ids?.length ?? 0) === 0) {
            fetchRandomEntry();
        } else {
            const currId = ids[index] ?? ids[ids.length - 1];
            resolveCurrent(currId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeStackId]);

    // Resolve whenever ids/index/languages change
    useEffect(() => {
        const currId = ids[index];
        resolveCurrent(currId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ids, index, languageCodes]);

    const scrollRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTo({ top: -200, behavior: "smooth" });
            }
        }, 33);
    }, [index]);

    const textByLang: Record<string, string> = {};
    const romanizationByLang: Record<string, string | undefined> = {};
    if (currEntry) {
        currEntry.translations.forEach((t) => {
            textByLang[t.language_code] = t.text;
            romanizationByLang[t.language_code] = t.romanization;
        });
        textByLang["en"] = currEntry.en_text;
    }

    const handlePrev = () => index > 0 && setIndex(index - 1);
    const handleNext = () => {
        if (index < ids.length - 1) setIndex(index + 1);
        else fetchRandomEntry();
    };

    const displayedLanguages = [...languages].reverse();

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full items-center relative">
            {currEntry && (
                <div
                    className="fixed top-5 pt-safe left-5 z-50 pointer-events-none"
                    style={{ background: "transparent", marginTop: getPlatformTopPaddingButtons() }}
                >
                    <div className="flex flex-wrap gap-1 items-center justify-center text-gray-400 text-xs mb-1">
                        <span className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-xs">
                            {currEntry.level.toUpperCase()}
                        </span>
                        {currEntry.domains.map((d) => (
                            <span
                                key={d}
                                className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-xs"
                            >
                                {t(`categories.${d}` as any) || d}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div
                className="flex-1 w-full overflow-y-auto min-h-0 px-2 pt-20 flex flex-col"
                ref={scrollRef}
                style={{
                    paddingBottom: `${getPlatformBottomPadding()}px`,
                    paddingTop: `${getPlatformTopPaddingTranslations()}px`,
                }}
            >
                <div
                    key={index}
                    className="w-full max-w-4xl mx-auto flex flex-col items-center gap-y-9 my-auto"
                >
                    {displayedLanguages.map((code, idx) => (
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
                                    const langPrefix = code.split("-")[0];
                                    const text = textByLang[code];
                                    if (!text) return;
                                    createVoiceTTS(langPrefix)(text, rate);
                                }}
                            >
                                <div className="text-xs text-gray-400">
                                    {t(`languages.${toCamelCase(code)}` as any) || code}
                                </div>
                                <div
                                    className="text-center text-xl md:text-2xl lg:text-3xl my-1"
                                    style={{ wordBreak: "break-word", maxWidth: "80vw", lineHeight: 1.1 }}
                                    dir={isRTL(code) ? "rtl" : "ltr"}
                                >
                                    {textByLang[code] || <span className="opacity-30">—</span>}
                                </div>
                                {showRomanization && romanizationByLang[code] && (
                                    <div
                                        className="text-center text-sm text-base text-gray-400 italic mt-1 mb-1 select-text"
                                        style={{ maxWidth: "80vw", wordBreak: "break-word" }}
                                    >
                                        {romanizationByLang[code]}
                                    </div>
                                )}

                                <motion.div
                                    whileTap={{ scale: 0.9 }}
                                    transition={{ type: "spring", stiffness: 100, damping: 10 }}
                                    className="transform-gpu will-change-transform"
                                >
                                    <Button className="mt-1" size="sm" variant="outline" style={{ cursor: "pointer" }}>
                                        <Speaker className="shrink-0" />
                                        <AudioLines className="shrink-0" />
                                        <Ear className="shrink-0" />
                                    </Button>
                                </motion.div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            <div
                className="fixed bottom-0 left-0 w-full flex justify-center z-50 pointer-events-none"
                style={{ background: "transparent", paddingBottom: getPlatformBottomPadding() / 6 }}
            >
                <div
                    className="flex flex-col gap-1 pointer-events-auto rounded-2xl shadow-2xl bg-white/95 px-8 py-3 border border-gray-200 items-center min-w-[280px]"
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
