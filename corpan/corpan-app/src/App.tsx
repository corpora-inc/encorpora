import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft as ChevronLeftIcon,
  RefreshCw as RefreshIcon,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import "./index.css";

// Types matching backend (adjust as needed)
export type TranslationOut = {
  language_code: string;
  text: string;
};

export type EntryOut = {
  entry_id: number;
  en_text: string;
  level: string;
  domains: string[];
  translations: TranslationOut[];
};

// Supported UI languages (add/remove as needed)
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ko: "Korean",
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

const HISTORY_KEY = "corpan_entry_history";

export default function App() {
  const [history, setHistory] = useState<EntryOut[]>([]);
  const [index, setIndex] = useState<number>(-1);
  const [loading, setLoading] = useState<boolean>(true);

  // User state: which translation to display as "target" language?
  const [targetLang, setTargetLang] = useState<string>("ko-polite");

  // (Optional) Level/domain filtering state could go here

  // Refs for async updates
  const indexRef = useRef<number>(index);
  useEffect(() => { indexRef.current = index; }, [index]);

  // Initial load: try history, else fetch
  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(HISTORY_KEY);
        if (raw) {
          try {
            const arr: EntryOut[] = JSON.parse(raw);
            if (arr.length) {
              setHistory(arr);
              setIndex(arr.length - 1);
              return;
            }
          } catch { /* invalid JSON, fallback */ }
        }
        // Otherwise, fetch one
        const entry = await fetchRandomEntry(targetLang);
        setHistory([entry]);
        setIndex(0);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, []);

  // Persist history to localStorage
  useEffect(() => {
    if (history.length) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }
  }, [history]);

  // --- Backend fetcher ---
  async function fetchRandomEntry(lang: string): Promise<EntryOut> {
    // You can add filters here (level, domain, etc)
    return await invoke<EntryOut>("get_random_entry_with_translations", {
      level: undefined,         // e.g., "A1"
      domain: undefined,        // e.g., "health"
      languageCodes: [lang, "en"], // fetch at least these two
    });
  }

  // Load a new random entry and append to history
  const fetchNew = async () => {
    setLoading(true);
    try {
      const entry = await fetchRandomEntry(targetLang);
      setHistory(prev => {
        const truncated = prev.slice(0, indexRef.current + 1);
        return [...truncated, entry];
      });
      setIndex(_ => indexRef.current + 1);
    } finally {
      setLoading(false);
    }
  };

  // Navigation
  const handlePrev = () => { if (index > 0) setIndex(i => i - 1); };
  const handleNext = () => {
    if (index < history.length - 1) {
      setIndex(i => i + 1);
    } else {
      fetchNew();
    }
  };

  // User switches target language
  const handleTargetLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTargetLang(e.target.value);
    // Optionally, fetch new entry in that language immediately
    fetchNew();
  };

  // Current card
  const curr = history[index];

  // Pull translation for selected language (fallback: show all)
  const selectedTranslation = curr?.translations.find(
    t => t.language_code === targetLang
  );

  return (
    <div className="h-full w-full flex items-center justify-center bg-gray-50">
      <div className="flex flex-col h-full w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-scroll">
        {/* Top: Language selector */}
        <div className="flex flex-row items-center justify-center gap-3 p-4">
          <label className="text-sm">Language:</label>
          <select
            value={targetLang}
            onChange={handleTargetLangChange}
            className="border rounded p-2 bg-white"
          >
            {Object.entries(LANGUAGE_NAMES).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {loading ? (
            <p>Loading…</p>
          ) : curr ? (
            <>
              {/* Target language */}
              <p className="text-5xl font-extrabold text-center mt-6 p-3 min-h-[3rem]">
                {selectedTranslation ? selectedTranslation.text : "(No translation available)"}
              </p>
              <div className="flex flex-row gap-2 mb-4">
                {/* TTS buttons or similar for selected language could go here */}
              </div>
              {/* English (always) */}
              <p className="text-lg text-gray-700 text-center">
                <span className="font-semibold">English:</span> {curr.en_text}
              </p>
              {/* Level / Domains */}
              <div className="text-sm mt-2 text-gray-500 text-center">
                <span className="px-2 py-1 bg-blue-50 rounded mr-2">{curr.level}</span>
                {curr.domains.map(domain => (
                  <span
                    key={domain}
                    className="px-2 py-1 bg-gray-100 rounded mx-1"
                  >
                    {domain}
                  </span>
                ))}
              </div>
              {/* All translations */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-500">Show all translations</summary>
                <ul className="mt-2 grid grid-cols-2 gap-2">
                  {curr.translations.map(t => (
                    <li key={t.language_code}>
                      <span className="font-semibold">{LANGUAGE_NAMES[t.language_code] || t.language_code}:</span>{" "}
                      {t.text}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            <p>No entry available.</p>
          )}
        </div>

        {/* Bottom nav */}
        <div className="flex-none bg-gray-100 border-t">
          <div className="flex justify-between items-center p-4">
            <Button
              onClick={handlePrev}
              disabled={loading || index <= 0}
              className="p-2"
              variant="outline"
              aria-label="Previous entry"
            >
              <ChevronLeftIcon className="w-6 h-6" />
            </Button>

            <Button
              onClick={fetchNew}
              disabled={loading}
              className="p-2"
              variant="outline"
              aria-label="Random entry"
            >
              <RefreshIcon className="w-6 h-6" />
            </Button>

            <Button
              onClick={handleNext}
              disabled={loading}
              className="p-2"
              variant="outline"
              aria-label="Next entry"
            >
              <ChevronRightIcon className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
