import { useEffect, useLayoutEffect, useRef } from "react";
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
import { useHistoryStore, EntryOut } from "@/store/history";
import { createVoiceTTS } from "@/util/speak";
import { TranslationKey } from "@/store/translations";

// Lame but OK
function getPlatformPadding() {
    if (/iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)) {
        return 240;
    }
    return 135;
}

export function MainExperience() {
    const languages = useSettingsStore((s) => s.languages);
    const domains = useSettingsStore((s) => s.domains);
    const levels = useSettingsStore((s) => s.levels);
    const rate = useSettingsStore((s) => s.rate);
    const t = useSettingsStore((s) => s.t);

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
                scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
            }
        }, 27);
    }, [index]);

    const curr = history[index] || null;
    const textByLang: Record<string, string> = {};
    if (curr) {
        curr.translations.forEach((t) => { textByLang[t.language_code] = t.text; });
        textByLang["en"] = curr.en_text;
    }

    // Navigation
    const handlePrev = () => index > 0 && setIndex(index - 1);
    const handleNext = () => {
        if (index < history.length - 1) setIndex(index + 1);
        else fetchRandomEntry();
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full items-center relative">

            {curr && (
                <div
                    className="fixed top-5 left-5 z-50 pointer-events-none"
                    style={{ background: "transparent" }}
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
                                {t(d as TranslationKey) || d}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Scrollable Translations */}
            <div
                className="flex-1 w-full overflow-y-auto min-h-0 px-2 pt-16 flex flex-col"
                ref={scrollRef}
                style={{
                    paddingBottom: `${getPlatformPadding()}px`,
                }}
            >

                <div
                    key={index}
                    className="w-full max-w-4xl mx-auto flex flex-col items-center gap-y-7 my-auto"
                >

                    {languages.map((code, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 16, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{ duration: 0.28, delay: idx * 0.04, ease: "easeOut" }}
                            className="w-full flex flex-col items-center"
                        >
                            <div
                                key={idx}
                                className="text-xs text-gray-400 mb-1"
                            >{t(code as TranslationKey) || code}</div>
                            <div
                                className="text-center text-xl md:text-2xl lg:text-3xl"
                                style={{
                                    wordBreak: "break-word",
                                    maxWidth: "80vw",
                                    lineHeight: 1.15,
                                }}
                                dir={code === "ar" ? "rtl" : "ltr"}
                            >
                                {textByLang[code] || <span className="opacity-30">—</span>}
                            </div>
                            <motion.div
                                whileTap={{ scale: 0.95 }}
                                transition={{ type: "spring", stiffness: 300, damping: 17 }}
                            >
                                <Button
                                    onClick={() => {
                                        const langPrefix = code.split("-")[0];
                                        createVoiceTTS(langPrefix)(
                                            textByLang[code],
                                            rate,
                                        );
                                    }}
                                    className="mt-2"
                                    size="sm"
                                    variant="outline"
                                >
                                    <Speaker className="w-4 h-4" />
                                    <AudioLines className="w-4 h-4" />
                                    <Ear className="w-4 h-4" />
                                </Button>
                            </motion.div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Floating Nav + Level/Domains */}
            < div
                className="fixed bottom-0 left-0 w-full flex justify-center pb-6 z-50 pointer-events-none"
                style={{ background: "transparent" }
                }
            >
                <div className="flex flex-col gap-1 pointer-events-auto rounded-2xl shadow-2xl bg-white/95 px-8 py-3 border border-gray-200 items-center min-w-[280px]">
                    <div className="flex justify-center items-center gap-8">
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
        </div>
    );
}
