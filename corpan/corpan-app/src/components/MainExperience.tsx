import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    ChevronLeft as ChevronLeftIcon,
    RefreshCw as RefreshIcon,
    ChevronRight as ChevronRightIcon,
    Speaker,
    AudioLines,
    Ear,
    Play as PlayIcon,
    Square as StopIcon,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings";
import { useHistoryStore, EntryOut } from "@/store/history";
import { createVoiceTTS } from "@/util/speak";
import { useTranslation } from "react-i18next";

import { isRTL, toCamelCase } from "@/util/convert";
import {
    getPlatformBottomPadding,
    getPlatformTopPaddingButtons,
    getPlatformTopPaddingTranslations,
    isAndroid,
} from "@/util/browser";

// // Even lamer but still fine
// const paddingAdjustMap: Record<string, number> = {
//     "small": -5,
//     "medium": 25,
//     "large": 50,
//     "extra-large": 75,
// }

export function MainExperience() {
    const languages = useSettingsStore((s) => s.languages);
    const domains = useSettingsStore((s) => s.domains);
    const levels = useSettingsStore((s) => s.levels);
    const rate = useSettingsStore((s) => s.rate);
    const autoplayDelayMs = useSettingsStore((s) => s.autoplayDelayMs);
    const { t } = useTranslation()
    // const textSize = useSettingsStore((s) => s.textSize);
    // console.log("textSize", textSize);

    const showRomanization = useSettingsStore((s) => s.showRomanization);

    const history = useHistoryStore((s) => s.history);
    const index = useHistoryStore((s) => s.index);
    const pushEntry = useHistoryStore((s) => s.pushEntry);
    const setIndex = useHistoryStore((s) => s.setIndex);

    // Fetch a random entry with all languages, push to history
    const fetchRandomEntry = async () => {
        setIndex(history.length - 1); // set index to the end of history
        try {
            const entry = await invoke<EntryOut>("get_random_entry_with_translations", { domains, levels });
            pushEntry(entry); // updates both history and index
        } finally {
        }
    };

    useEffect(() => {
        if (history.length === 0) fetchRandomEntry();
    }, []);

    const scrollRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTo({ top: -200, behavior: "smooth" });
            }
        }, 33);
    }, [index]);

    const curr = history[index] || null;

    // Build translation lookup by language code
    const textByLang: Record<string, string> = {};
    const romanizationByLang: Record<string, string | undefined> = {};
    if (curr) {
        curr.translations.forEach((t) => {
            textByLang[t.language_code] = t.text;
            romanizationByLang[t.language_code] = t.romanization;
        });
        textByLang["en"] = curr.en_text;
    }

    // console.log(showRomanization, romanizationByLang);

    // Navigation
    const handlePrev = () => index > 0 && setIndex(index - 1);
    const handleNext = () => {
        if (index < history.length - 1) setIndex(index + 1);
        else fetchRandomEntry();
    };

    const displayedLanguages = [...languages].reverse();

    // Autoplay state
    const [autoplay, setAutoplay] = useState(false);
    const autoplayRef = useRef(false);
    autoplayRef.current = autoplay;

    // Cancel flag for async loop
    const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });

    const speakAllForCurrent = useCallback(async () => {
        const currLocal = history[index];
        if (!currLocal) return;
        // Sequence languages in displayed order
        for (const code of displayedLanguages) {
            if (!autoplayRef.current || cancelRef.current.cancelled) return;
            const langPrefix = code.split("-")[0];
            const text = textByLang[code];
            if (text) {
                try {
                    await createVoiceTTS(langPrefix)(text, rate);
                } catch { /* ignore */ }
            }
            // Delay between sentences if still autoplaying
            if (!autoplayRef.current || cancelRef.current.cancelled) return;
            await new Promise(r => setTimeout(r, autoplayDelayMs));
        }
    }, [history, index, displayedLanguages, textByLang, rate, autoplayDelayMs]);

    // Main autoplay effect
    useEffect(() => {
        if (!autoplay) {
            cancelRef.current.cancelled = true;
            cancelRef.current = { cancelled: false };
            return;
        }
        let active = true;
        cancelRef.current = { cancelled: false };

        (async () => {
            while (active && autoplayRef.current) {
                await speakAllForCurrent();
                if (!autoplayRef.current || cancelRef.current.cancelled) break;
                // Move to next entry (will fetch new if needed)
                if (index < history.length - 1) setIndex(index + 1); else await fetchRandomEntry();
                // Wait a tiny gap before next batch
                await new Promise(r => setTimeout(r, Math.min(autoplayDelayMs, 800)));
            }
        })();

        return () => { active = false; cancelRef.current.cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoplay, index, history.length, speakAllForCurrent]);

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full items-center relative">

            {/* Floating domain/level stuff at top left */}
            {curr && (
                <div
                    className="fixed top-5 pt-safe left-5 z-50 pointer-events-none"
                    style={{
                        background: "transparent",
                        marginTop: getPlatformTopPaddingButtons(),
                    }}

                >
                    <div className="flex flex-wrap gap-1 items-center justify-center text-gray-400 text-xs mb-1">
                        <span
                            className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-xs"
                        >{curr.level.toUpperCase()}</span>
                        {curr.domains.map((d) => (
                            <span
                                key={d}
                                className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-xs"
                            >
                                {t(`categories.${d}` as any) || d}
                            </span>
                        ))}
                    </div>
                </div>
            )
            }

            {/* Scrollable Translations */}
            <div
                className="flex-1 w-full overflow-y-auto min-h-0 px-2 pt-20 flex flex-col"
                ref={scrollRef}
                style={{
                    // marginTop: isAndroid() ? "20px" : undefined,
                    // paddingBottom: `${getPlatformPadding() + paddingAdjustMap[textSize]}px`,
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
                                // Add style for pointer on hover:
                                style={{ cursor: "pointer" }}
                                onClick={() => {
                                    const langPrefix = code.split("-")[0];
                                    createVoiceTTS(langPrefix)(
                                        textByLang[code],
                                        rate,
                                    );
                                }}
                            >
                                <div
                                    key={idx}
                                    className="text-xs text-gray-400"
                                >{t(`languages.${toCamelCase(code)}` as any) || code}</div>
                                <div
                                    className="text-center text-xl md:text-2xl lg:text-3xl my-1"
                                    style={{
                                        wordBreak: "break-word",
                                        maxWidth: "80vw",
                                        lineHeight: 1.1,
                                    }}
                                    dir={isRTL(code) ? "rtl" : "ltr"}
                                >
                                    {textByLang[code] || <span className="opacity-30">—</span>}
                                </div>
                                {/* Render romanization if enabled and available */}
                                {showRomanization && romanizationByLang[code] && (
                                    <div className="text-center text-sm  text-gray-400 italic mt-1 mb-1 select-text"
                                        style={{
                                            maxWidth: "80vw",
                                            wordBreak: "break-word",
                                            // lineHeight: 0.95,
                                        }}
                                    >
                                        {romanizationByLang[code]}
                                    </div>
                                )}


                                <motion.div
                                    whileTap={{ scale: 0.9 }}
                                    transition={{ type: "spring", stiffness: 100, damping: 10 }}
                                    className="transform-gpu will-change-transform"
                                >
                                    <Button
                                        className="mt-1"
                                        size="sm"
                                        variant="outline"
                                        style={{ cursor: "pointer" }}
                                    >
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

            {/* Floating Nav */}
            <div
                className="fixed bottom-0 left-0 w-full flex justify-center z-50 pointer-events-none"
                style={{
                    background: "transparent",
                    paddingBottom: getPlatformBottomPadding() / 6,
                }}
            >
                <div className="flex flex-col gap-1 pointer-events-auto rounded-2xl shadow-2xl bg-white/95 px-8 py-3 border border-gray-200 items-center min-w-[280px]"
                    style={{ marginBottom: isAndroid() ? "39px" : 0 }}
                >
                    <div className="flex justify-center items-center gap-3">
                        <Button
                            onClick={() => setAutoplay(a => !a)}
                            variant={autoplay ? "default" : "outline"}
                            size="lg"
                            aria-label={autoplay ? "Stop autoplay" : "Start autoplay"}
                        >
                            {autoplay ? <StopIcon /> : <PlayIcon />}
                        </Button>
                        <Button
                            onClick={handlePrev}
                            variant="ghost"
                            size="lg"
                            aria-label="Previous sentence"
                        >
                            <ChevronLeftIcon />
                        </Button>
                        <Button
                            onClick={fetchRandomEntry}
                            variant="outline"
                            size="lg"
                            aria-label="Random sentence"
                        >
                            <RefreshIcon />
                        </Button>
                        <Button
                            onClick={handleNext}
                            variant="ghost"
                            size="lg"
                            aria-label="Next sentence"
                        >
                            <ChevronRightIcon />
                        </Button>
                    </div>
                    <span className="text-xs text-gray-400 mt-1">
                        {index + 1}/{history.length}
                    </span>
                </div>
            </div>
        </div >
    );
}