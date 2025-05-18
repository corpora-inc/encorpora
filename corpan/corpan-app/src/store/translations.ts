export const TRANSLATIONS = {
    en: {
        welcome: "Welcome",
        start: "Get Started",
        tts_error: "TTS voice not installed",
    },
    fr: {
        welcome: "Bienvenue",
        start: "Commencer",
        tts_error: "Voix TTS non installée",
    },
    ko: {
        welcome: "환영합니다",
        start: "시작하기",
        tts_error: "TTS 음성이 설치되어 있지 않습니다",
    },
    // ... etc for other languages
} as const;

type TranslationMap = typeof TRANSLATIONS;
export type TranslationKey = keyof TranslationMap["en"];
