import { create } from "zustand";
import { persist } from "zustand/middleware";

// All supported languages and domains, for convenience
export const ALL_LANGUAGES = [
    "en", "ko-polite", "es", "fr", "de", "pt-BR", "ja", "zh-Hans", "ar", "ru", "it", "hi",
];
export const ALL_LEVELS = ["A1", "A2", "B1"];
export const ALL_DOMAINS = [
    "travel", "business", "education", "social", "health", "housing", "numbers",
    "civic", "technology", "environment", "emergency", "culture", "everyday",
];

type SettingsState = {
    languages: string[]; // ordered list
    setLanguages: (codes: string[]) => void;
    domains: string[];
    setDomains: (domains: string[]) => void;
    levels: string[];
    setLevels: (levels: string[]) => void;
    reset: () => void;
};

// Persist to localStorage, so settings stick between runs.
export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            languages: ["en", "es", "pt-BR", "fr", "it", "ko-polite"],
            setLanguages: (codes) => set({ languages: codes }),
            domains: [...ALL_DOMAINS], // default: all
            setDomains: (domains) => set({ domains }),
            levels: ["A1"],
            setLevels: (levels) => set({ levels }),
            reset: () =>
                set({
                    languages: ["en", "es", "pt-BR", "fr", "it", "ko-polite"],
                    domains: [...ALL_DOMAINS],
                    levels: ["A1"],
                }),
        }),
        { name: "corpan-settings" }
    )
);
