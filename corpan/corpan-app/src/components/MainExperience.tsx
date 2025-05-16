import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings";
import { createVoiceTTS } from "@/util/speak";
import {
    ChevronLeft as ChevronLeftIcon,
    RefreshCw as RefreshIcon,
    ChevronRight as ChevronRightIcon,
} from "lucide-react";

// --- Language & Domain Names ---
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
    travel: "Travel",
    business: "Business",
    education: "Education",
    social: "Social",
    health: "Health",
    housing: "Housing",
    numbers: "Numbers",
    civic: "Civic",
    technology: "Technology",
    environment: "Environment",
    emergency: "Emergency",
    culture: "Culture",
    everyday: "Everyday",
};

type TranslationOut = { language_code: string; text: string };
type EntryOut = {
    entry_id: number;
    en_text: string;
    level: string;
    domains: string[];
    translations: TranslationOut[];
};

const NAV_HEIGHT = 108; // px - enough for nav+level+domains+margin

export function MainExperience() {
    const languages = useSettingsStore((s) => s.languages);
    const domains = useSettingsStore((s) => s.domains);
    const levels = useSettingsStore((s) => s.levels);

    const [history, setHistory] = useState<EntryOut[]>([]);
    const [index, setIndex] = useState(-1);
    const [loading, setLoading] = useState(true);

    const indexRef = useRef(index);
    useEffect(() => { indexRef.current = index; }, [index]);

    // Fetch a random entry with all languages
    const fetchRandomEntry = async () => {
        setLoading(true);
        try {
            const entry = await invoke<EntryOut>("get_random_entry_with_translations", {
                domains,
                levels,
            });
            setHistory((prev) => {
                const next = [...prev.slice(0, indexRef.current + 1), entry];
                setIndex(next.length - 1);
                return next;
            });
        } finally {
            setLoading(false);
        }
    };

    // On mount: load one entry
    useEffect(() => { fetchRandomEntry(); /* eslint-disable-next-line */ }, []);
    // On domains/levels change, reset history and fetch
    useEffect(() => {
        if (!loading) {
            setHistory([]);
            setIndex(-1);
            fetchRandomEntry();
        }
        // eslint-disable-next-line
    }, [JSON.stringify(domains), JSON.stringify(levels)]);

    const curr = history[index];
    const textByLang: Record<string, string> = {};
    if (curr) {
        curr.translations.forEach((t) => { textByLang[t.language_code] = t.text; });
        textByLang["en"] = curr.en_text;
    }

    // Navigation
    const handlePrev = () => index > 0 && setIndex((i) => i - 1);
    const handleNext = () => {
        if (index < history.length - 1) setIndex((i) => i + 1);
        else fetchRandomEntry();
    };

    // --- MAIN RENDER ---
    return (
        <>

            <div className="relative h-screen w-full flex flex-col items-center justify-center">
                {curr && (
                    <div
                        // className="fixed top-0 left-0 w-full flex justify-center pt-6 z-50 pointer-events-none"
                        className="fixed top-5 left-5 z-50 pointer-events-none"
                        style={{ background: "transparent" }}
                    >

                        <div className="flex flex-wrap gap-1 items-center justify-center text-gray-400 text-xs mb-1">
                            <span
                                // className="font-semibold text-gray-400 text-xs"
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
                <div
                    className="w-full flex-1 overflow-y-auto"
                    style={{
                        // Always leave space for nav at bottom (never cut off)
                        paddingTop: "7vh",
                        paddingBottom: `${NAV_HEIGHT}px`,
                    }}
                >
                    <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-y-3">
                        {loading ? (
                            <div className="w-full text-center text-lg text-gray-400 py-20">Loading…</div>
                        ) : !curr ? (
                            <div className="w-full text-center text-lg text-gray-400 py-20">No sentence found.</div>
                        ) : (
                            languages.map((code) => (
                                <div
                                    key={code}
                                    className="w-full flex flex-col items-center mb-6"
                                >
                                    <div className="text-xs text-gray-400 mb-1">{LANGUAGE_NAMES[code] || code}</div>
                                    <div
                                        className="text-center text-2xl md:text-3xl lg:text-4xl"
                                        style={{
                                            wordBreak: "break-word",
                                            maxWidth: "80vw",
                                            lineHeight: 1.15,
                                        }}
                                        dir={code === "ar" ? "rtl" : "ltr"}
                                    >
                                        {textByLang[code] || <span className="opacity-30">—</span>}
                                    </div>
                                    <Button
                                        onClick={() => {
                                            const langPrefix = code.split("-")[0];
                                            createVoiceTTS(langPrefix)(textByLang[code]);
                                        }}
                                        className="mt-2"
                                        size="sm"
                                        variant="outline"
                                    >
                                        Speak
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Floating Nav + Level/Domains */}
                <div
                    className="fixed bottom-0 left-0 w-full flex justify-center pb-6 z-50 pointer-events-none"
                    style={{ background: "transparent" }}
                >
                    <div className="flex flex-col gap-1 pointer-events-auto rounded-2xl shadow-lg bg-white/95 px-8 py-3 border border-gray-200 items-center min-w-[270px]">
                        {/* Level/domains */}
                        {/* Nav */}
                        <div className="flex justify-center items-center gap-5">
                            <Button
                                onClick={handlePrev}
                                disabled={loading || index <= 0}
                                variant="ghost"
                                size="icon"
                                aria-label="Previous sentence"
                            >
                                <ChevronLeftIcon className="w-7 h-7" />
                            </Button>
                            <Button
                                onClick={fetchRandomEntry}
                                disabled={loading}
                                variant="outline"
                                size="icon"
                                aria-label="Random sentence"
                            >
                                <RefreshIcon className="w-7 h-7" />
                            </Button>
                            <Button
                                onClick={handleNext}
                                disabled={loading}
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
                </div>
            </div>
        </>
    );
}
