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

// --- Complete Language and Domain Names ---
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

// Adjust these heights as needed for your layout.
const NAV_HEIGHT = 90; // px (height of the floating nav/info)
const HEADER_HEIGHT = 56; // px (height of your header, if any)

export function MainExperience() {
    // Settings from zustand
    const languages = useSettingsStore((s) => s.languages);
    const domains = useSettingsStore((s) => s.domains);
    const levels = useSettingsStore((s) => s.levels);

    // History
    const [history, setHistory] = useState<EntryOut[]>([]);
    const [index, setIndex] = useState(-1);
    const [loading, setLoading] = useState(true);

    const indexRef = useRef(index);
    useEffect(() => { indexRef.current = index; }, [index]);

    // Fetch a new entry (filtered by levels/domains)
    const fetchRandomEntry = async () => {
        setLoading(true);
        try {
            const entry = await invoke<EntryOut>("get_random_entry_with_translations", { domains, levels });
            setHistory(prev => {
                const next = [...prev.slice(0, indexRef.current + 1), entry];
                setIndex(next.length - 1);
                return next;
            });
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => { fetchRandomEntry(); /* eslint-disable-next-line */ }, []);

    // Reload on settings change
    useEffect(() => {
        if (!loading) {
            setHistory([]);
            setIndex(-1);
            fetchRandomEntry();
        }
        // eslint-disable-next-line
    }, [JSON.stringify(domains), JSON.stringify(levels)]);

    const curr = history[index];

    // Map: language_code -> text
    const textByLang: Record<string, string> = {};
    if (curr) {
        curr.translations.forEach((t) => { textByLang[t.language_code] = t.text; });
        textByLang["en"] = curr.en_text;
    }

    // Nav handlers
    const handlePrev = () => index > 0 && setIndex(i => i - 1);
    const handleNext = () => {
        if (index < history.length - 1) setIndex(i => i + 1);
        else fetchRandomEntry();
    };

    // --- Actual UI ---
    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
            {/* Scrollable Translations Area */}
            <div
                className="w-full flex-1 overflow-y-auto"
                style={{
                    maxHeight: `calc(100vh - ${HEADER_HEIGHT + NAV_HEIGHT}px)`,
                    paddingTop: "8vh",
                    paddingBottom: `${NAV_HEIGHT + 16}px`, // Ensure last line is above nav
                }}
            >
                <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-0">
                    {loading ? (
                        <div className="w-full text-center text-lg text-gray-400 py-20">Loading…</div>
                    ) : !curr ? (
                        <div className="w-full text-center text-lg text-gray-400 py-20">No sentence found.</div>
                    ) : (
                        languages.map((code, idx) => (
                            <div
                                key={code}
                                className={`w-full flex flex-col items-center mb-2`}
                                style={{
                                    // Give top language more breathing room & max width
                                    marginBottom: idx === 0 ? "2.5rem" : "1.5rem",
                                    marginTop: idx === 0 ? "1rem" : 0,
                                }}
                            >
                                <div className="text-xs text-gray-400 mb-1">{LANGUAGE_NAMES[code] || code}</div>
                                <div
                                    className={`font-bold text-center
                    ${idx === 0
                                            ? "text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
                                            : "text-xl sm:text-2xl md:text-3xl"}
                  `}
                                    style={{
                                        wordBreak: "break-word",
                                        maxWidth: idx === 0 ? "80vw" : "56vw",
                                        lineHeight: 1.18,
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
                                    size={idx === 0 ? "lg" : "sm"}
                                    variant="outline"
                                >
                                    Speak
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Floating nav+info (ALWAYS visible, pointer-events-auto) */}
            <div
                className="fixed bottom-0 left-0 w-full flex justify-center pb-5 z-50 pointer-events-none"
                style={{ background: "transparent" }}
            >
                <div className="flex flex-col gap-1 pointer-events-auto rounded-2xl shadow-lg bg-white/95 px-7 py-3 border border-gray-200 items-center">
                    {/* Level/domains info bar */}
                    {curr && (
                        <div className="flex flex-wrap gap-2 items-center justify-center text-gray-400 text-xs mb-1">
                            <span className="font-semibold">{curr.level}</span>
                            {curr.domains.map((d) => (
                                <span
                                    key={d}
                                    className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-xs"
                                >
                                    {DOMAIN_NAMES[d] || d}
                                </span>
                            ))}
                        </div>
                    )}
                    {/* Nav */}
                    <div className="flex justify-center items-center gap-3">
                        <Button
                            onClick={handlePrev}
                            disabled={loading || index <= 0}
                            variant="ghost"
                            size="icon"
                            aria-label="Previous sentence"
                        >
                            <ChevronLeftIcon className="w-6 h-6" />
                        </Button>
                        <Button
                            onClick={fetchRandomEntry}
                            disabled={loading}
                            variant="outline"
                            size="icon"
                            aria-label="Random sentence"
                        >
                            <RefreshIcon className="w-6 h-6" />
                        </Button>
                        <Button
                            onClick={handleNext}
                            disabled={loading}
                            variant="ghost"
                            size="icon"
                            aria-label="Next sentence"
                        >
                            <ChevronRightIcon className="w-6 h-6" />
                        </Button>
                        <span className="ml-4 text-xs text-gray-400 self-center">
                            {index + 1}/{history.length}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
