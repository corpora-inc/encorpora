import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
    TRANSLATIONS,
    TranslationKey,
} from "./translations";
import { RTL_LANGUAGES } from "./constants";

export const ALL_LANGUAGES = [
    "en", "ko-polite", "es", "fr", "de", "pt-BR", "ja", "zh-Hans", "ar", "ru", "it", "hi", "vi",
];

export const ALL_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const ALL_DOMAINS = [
    "travel", "business", "education", "social", "health", "housing", "numbers",
    "civic", "technology", "environment", "emergency", "culture", "everyday",
];

export const ALL_TEXT_SIZES = ["small", "medium", "large", "extra-large"] as const;
export type TextSizeType = typeof ALL_TEXT_SIZES[number];

type SettingsState = {
    languages: string[];
    setLanguages: (codes: string[]) => void;
    domains: string[];
    setDomains: (domains: string[]) => void;
    levels: string[];
    setLevels: (levels: string[]) => void;
    reset: () => void;
    rate: number;
    setRate: (rate: number) => void;
    textSize: TextSizeType;
    setTextSize: (size: TextSizeType) => void;
    showRomanization: boolean;
    setShowRomanization: (val: boolean) => void;
    topLang: () => string;
    t: (key: TranslationKey) => string;
    dir: () => "ltr" | "rtl";

    onboarded: boolean;
    setOnboarded: (b: boolean) => void;
    resetOnboarding: () => void;
    onboardingStep: number;
    setOnboardingStep: (n: number) => void;
};

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            languages: ["en", "es", "pt-BR", "fr", "it", "ko-polite"],
            setLanguages: (codes) => set({ languages: codes }),
            domains: [...ALL_DOMAINS],
            setDomains: (domains) => set({ domains }),
            levels: ["A1"],
            setLevels: (levels) => set({ levels }),
            reset: () =>
                set({
                    languages: ["en", "es", "pt-BR", "fr", "it", "ko-polite"],
                    domains: [...ALL_DOMAINS],
                    levels: ["A1"],
                    textSize: "medium", // Add textSize to reset
                }),
            rate: 0.7,
            setRate: (rate) => set({ rate }),
            textSize: "medium",
            setTextSize: (size) => set({ textSize: size }),

            showRomanization: true,
            setShowRomanization: (val) => set({ showRomanization: val }),

            topLang: () => get().languages[0],

            t: (key) => {
                const lang = get().languages[0];
                const base = lang.split("-")[0] as keyof typeof TRANSLATIONS;
                return TRANSLATIONS[lang as keyof typeof TRANSLATIONS]?.[key]
                    ?? TRANSLATIONS[base]?.[key]
                    ?? TRANSLATIONS.en[key];
            },
            dir: () => {
                const lang = get().languages[0];
                const base = lang.split("-")[0];
                return RTL_LANGUAGES.includes(base as any) ? "rtl" : "ltr";
            },
            onboarded: false,
            setOnboarded: (b) => set({ onboarded: b }),
            resetOnboarding: () =>
                set({
                    onboarded: false,
                    languages: [],
                }),
            onboardingStep: 0,
            setOnboardingStep: (n) => set({ onboardingStep: n }),
        }),
        { name: "corpan-settings" }
    )
);
