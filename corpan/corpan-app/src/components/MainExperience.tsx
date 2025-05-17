import { useEffect, useLayoutEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings";
import { useHistoryStore, EntryOut } from "@/store/history";
import { createVoiceTTS } from "@/util/speak";
import {
    ChevronLeft as ChevronLeftIcon,
    RefreshCw as RefreshIcon,
    ChevronRight as ChevronRightIcon,
    // SpeakerIcon,
    Speaker,
    // AudioWaveformIcon,
    AudioLines,
    Ear,
    // FileAudio,
} from "lucide-react";
import { motion } from "framer-motion";
// import { LANGUAGE_NAMES } from "./LanguageSelectOrder";

const LANGUAGE_NAMES: Record<string, string> = {
    en: "English",
    "ko-polite": "Korean (Polite)",
    es: "Spanish",
    fr: "French",
    de: "German",
    "pt-BR": "Portuguese (BR)",
    ja: "Japanese",
    "zh-Hans": "Chinese (Simplified)",
    ar: "Arabic",
    ru: "Russian",
    it: "Italian",
    hi: "Hindi",
};


const DOMAIN_NAMES: Record<string, string> = {
    travel: "Travel", business: "Business", education: "Education", social: "Social",
    health: "Health", housing: "Housing", numbers: "Numbers", civic: "Civic",
    technology: "Technology", environment: "Environment", emergency: "Emergency",
    culture: "Culture", everyday: "Everyday",
};

// const NAV_HEIGHT = 108; // px - enough for nav+level+domains+margin

export function MainExperience() {
    const languages = useSettingsStore((s) => s.languages);
    const domains = useSettingsStore((s) => s.domains);
    const levels = useSettingsStore((s) => s.levels);
    const rate = useSettingsStore((s) => s.rate);

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

    // --- On mount: load if empty
    useEffect(() => {
        if (history.length === 0) fetchRandomEntry();
        // eslint-disable-next-line
    }, []);

    const scrollRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        requestAnimationFrame(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTo({ top: -10000, behavior: "smooth" });
            }
        });
    }, [index]);


    // useLayoutEffect(() => {
    //     console.log("Index changed:", index, scrollRef.current);
    //     if (scrollRef.current) {
    //         console.log("Scrolling", scrollRef.current.scrollHeight);
    //         // scrollRef.current.scrollTo({ top: -5000, behavior: "smooth" });
    //         console.log("from", scrollRef.current.scrollTop);
    //         scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    //         console.log("to", scrollRef.current.scrollTop);
    //         // scrollRef.current.
    //         // scrollRef.current.scrollHeight = 0;
    //         scrollRef.current.scrollTop = 0;
    //     }

    // }, [index]);

    // const firstSentenceRef = useRef<HTMLDivElement | null>(null);


    // useLayoutEffect(() => {
    //     // Always try to scroll the first sentence into view
    //     if (firstSentenceRef.current) {
    //         console.log("Scrolling to first sentence:", firstSentenceRef.current);
    //         firstSentenceRef.current.scrollIntoView({
    //             behavior: "smooth", // Or "auto" if you want instant
    //             block: "end",
    //             // inline: "start", // Or "nearest" if you want to avoid scrolling
    //         });
    //     }
    // }, [index]);


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

    // --- MAIN RENDER ---
    return (
        <div className="relative h-screen w-full flex flex-col items-center justify-center">
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
                                {DOMAIN_NAMES[d] || d}
                            </span>
                        ))}
                    </div>
                </div>
            )}
            {/* Scrollable Translations */}
            <div className="flex-1 w-full flex flex-col min-h-0">
                <div
                    ref={scrollRef}
                    className="flex-1 flex flex-col items-center justify-center overflow-y-auto min-h-0 px-2"
                    style={{
                        // Remove max-h-full! It’s not needed.
                        paddingTop: "0vh",
                        paddingBottom: 0,
                    }}
                >
                    <div
                        key={index}

                        className="w-full max-w-4xl flex flex-col items-center gap-y-7 pb-36 pt-15"
                    >

                        {languages.map((code, idx) => (
                            <motion.div
                                // key={code}
                                key={idx}
                                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                transition={{ duration: 0.28, delay: idx * 0.04, ease: "easeOut" }}
                                className="w-full flex flex-col items-center"
                            // ref={idx === 0 ? firstSentenceRef : null}
                            >
                                <div
                                    key={idx}
                                    // ref={idx === 0 ? firstSentenceRef : null}
                                    className="text-xs text-gray-400 mb-1" > {LANGUAGE_NAMES[code] || code}</div>
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
                                        {/* <AudioWaveformIcon className="w-4 h-4" /> */}
                                        <AudioLines className="w-4 h-4" />
                                        {/* <FileAudio className="w-4 h-4" /> */}
                                        <Ear className="w-4 h-4" />

                                    </Button>
                                </motion.div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div >

            {/* Floating Nav + Level/Domains */}
            < div
                className="fixed bottom-0 left-0 w-full flex justify-center pb-6 z-50 pointer-events-none"
                style={{ background: "transparent" }
                }
            >
                <div className="flex flex-col gap-1 pointer-events-auto rounded-2xl shadow-2xl bg-white/95 px-8 py-3 border border-gray-200 items-center min-w-[270px]">
                    <div className="flex justify-center items-center gap-5">
                        <Button
                            onClick={handlePrev}
                            variant="ghost"
                            size="icon"
                            aria-label="Previous sentence"
                        >
                            <ChevronLeftIcon className="w-7 h-7" />
                        </Button>
                        <Button
                            onClick={fetchRandomEntry}
                            variant="outline"
                            size="icon"
                            aria-label="Random sentence"
                        >
                            <RefreshIcon className="w-7 h-7" />
                        </Button>
                        <Button
                            onClick={handleNext}
                            variant="ghost"
                            size="icon"
                            aria-label="Next sentence"
                        >
                            <ChevronRightIcon className="w-7 h-7" />
                        </Button>
                    </div>
                    <span className="text-xs text-gray-400 mt-1">
                        {index + 1}/{history.length}
                    </span>
                </div>
            </div >
        </div >
    );
}
