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

const LANGUAGE_NAMES: Record<string, string> = {
    en: "English", "ko-polite": "Korean (Polite)", es: "Spanish", fr: "French",
    de: "German", "pt-BR": "Portuguese (BR)", ja: "Japanese", "zh-Hans": "Chinese (Simplified)",
    ar: "Arabic", ru: "Russian", it: "Italian", hi: "Hindi",
};
const DOMAIN_NAMES: Record<string, string> = {
    travel: "Travel", business: "Business", education: "Education", social: "Social", health: "Health",
    housing: "Housing", numbers: "Numbers", civic: "Civic", technology: "Technology",
    environment: "Environment", emergency: "Emergency", culture: "Culture", everyday: "Everyday",
};

type TranslationOut = { language_code: string; text: string };
type EntryOut = {
    entry_id: number;
    en_text: string;
    level: string;
    domains: string[];
    translations: TranslationOut[];
};

export function MainExperience() {
    const languages = useSettingsStore((s) => s.languages);
    const domains = useSettingsStore((s) => s.domains);
    const levels = useSettingsStore((s) => s.levels);

    const [history, setHistory] = useState<EntryOut[]>([]);
    const [index, setIndex] = useState(-1);
    const [loading, setLoading] = useState(true);

    const indexRef = useRef(index);
    useEffect(() => { indexRef.current = index; }, [index]);

    // Fetch and display a random entry
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

    useEffect(() => { fetchRandomEntry(); /* eslint-disable-next-line */ }, []);
    useEffect(() => { if (!loading) { setHistory([]); setIndex(-1); fetchRandomEntry(); } }, [JSON.stringify(domains), JSON.stringify(levels)]);

    const curr = history[index];
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

    // Top info: CEFR Level and Domains (fixed, light)
    function LevelDomainBar() {
        if (!curr) return null;
        return (
            <div className="w-full flex flex-wrap items-center justify-center gap-2 pb-4 text-gray-400 text-sm sticky top-0 z-10 bg-gray-50/80 backdrop-blur">
                <span className="font-semibold">{curr.level}</span>
                {curr.domains.map((d) => (
                    <span
                        key={d}
                        className="px-2 py-0.5 rounded-full border border-gray-200 bg-white/70 text-xs"
                    >
                        {DOMAIN_NAMES[d] || d}
                    </span>
                ))}
            </div>
        );
    }

    // Main
    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
            {/* Top info bar */}
            <LevelDomainBar />

            {/* Translations: scrollable if needed */}
            <div className="flex-1 w-full overflow-y-auto">
                <div className="flex flex-col items-center justify-center gap-0">
                    {loading ? (
                        <div className="w-full text-center text-lg text-gray-400 py-20">Loading…</div>
                    ) : !curr ? (
                        <div className="w-full text-center text-lg text-gray-400 py-20">No sentence found.</div>
                    ) : (
                        languages.map((code, idx) => (
                            <div
                                key={code}
                                className={`w-full max-w-3xl px-2 md:px-8 mx-auto py-4 flex flex-col items-center
                  ${idx === 0 ? "mb-2" : ""}
                `}
                                style={{ border: "none", background: "none" }}
                            >
                                <div className="text-xs text-gray-400 mb-1">{LANGUAGE_NAMES[code] || code}</div>
                                <div
                                    className={`font-bold text-center
                    ${idx === 0
                                            ? "text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
                                            : "text-xl sm:text-2xl md:text-3xl"}
                  `}
                                    style={{ wordBreak: "break-word", lineHeight: 1.25 }}
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

            {/* Nav controls: fixed at the bottom, floating & beautiful */}
            <div className="fixed bottom-0 left-0 w-full flex justify-center pb-4 pointer-events-none z-50">
                <div className="flex gap-4 rounded-xl shadow-lg bg-white/90 px-6 py-3 pointer-events-auto border border-gray-200">
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
                    <span className="ml-4 text-xs text-gray-400 self-center">{index + 1}/{history.length}</span>
                </div>
            </div>
        </div>
    );
}
