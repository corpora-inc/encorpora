// src/store/translations.ts

/**
 * Minimal translations for onboarding.
 * We keep:
 *  - a "welcome" word per language (for the animated welcome screen)
 *  - a "make primary language" label per language that NAMES THE LANGUAGE
 *  - autonyms (language self-names) for display/fallbacks
 */

export const WELCOME_BY_LANG = {
    en: "Welcome",
    "ko-polite": "환영합니다",
    es: "Bienvenido",
    fr: "Bienvenue",
    de: "Willkommen",
    "pt-BR": "Bem-vindo",
    ja: "ようこそ",
    "zh-Hans": "欢迎",
    "zh-Hant": "歡迎",
    ar: "أهلاً وسهلاً",
    ru: "Добро пожаловать",
    it: "Benvenuto",
    hi: "स्वागत है",
    vi: "Chào mừng",
    pl: "Witamy",
    hu: "Üdvözöljük",
    fa: "خوش آمدید",
    bn: "স্বাগতম",
} as const;
export type WelcomeCode = keyof typeof WELCOME_BY_LANG;

/** Autonyms (self-names) for language codes used in onboarding lists. */
export const AUTONYM_BY_LANG = {
    en: "English",
    "ko-polite": "한국어 (존댓말)",
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    "pt-BR": "Português (Brasil)",
    ja: "日本語",
    "zh-Hans": "中文（简体）",
    "zh-Hant": "中文（繁體）",
    ar: "العربية",
    ru: "Русский",
    it: "Italiano",
    hi: "हिन्दी",
    vi: "Tiếng Việt",
    pl: "Polski",
    hu: "Magyar",
    fa: "فارسی",
    bn: "বাংলা",
} as const;
export type LanguageCode = keyof typeof AUTONYM_BY_LANG;

/**
 * “Make <Language> my primary language” — each string explicitly names
 * the language (autonym) inside the sentence.
 */
export const MAKE_PRIMARY_BY_LANG = {
    en: "Make English my primary language",
    "ko-polite": "한국어를 기본 언어로 설정하기",
    es: "Hacer que el español sea mi idioma principal",
    fr: "Définir le français comme langue principale",
    de: "Deutsch als meine Hauptsprache festlegen",
    "pt-BR": "Tornar o português meu idioma principal",
    ja: "日本語を主言語にする",
    "zh-Hans": "将简体中文设为我的主要语言",
    "zh-Hant": "將繁體中文設為我的主要語言",
    ar: "اجعل العربية لغتي الرئيسية",
    ru: "Сделать русский основным языком",
    it: "Imposta l’italiano come lingua principale",
    hi: "हिंदी को मेरी मुख्य भाषा बनाएं",
    vi: "Đặt tiếng Việt làm ngôn ngữ chính của tôi",
    pl: "Ustaw polski jako mój język główny",
    hu: "A magyart állítsa be elsődleges nyelvnek",
    fa: "فارسی را زبان اصلی من کن",
    bn: "বাংলাকে আমার প্রধান ভাষা করুন",
} as const;
export type MakePrimaryCode = keyof typeof MAKE_PRIMARY_BY_LANG;

/** Safe helpers (work with any string code, fall back gracefully). */
export function getWelcomeLabel(code: string): string {
    return (WELCOME_BY_LANG as Record<string, string>)[code] ?? WELCOME_BY_LANG.en;
}

export function getMakePrimaryLabel(code: string): string {
    return (MAKE_PRIMARY_BY_LANG as Record<string, string>)[code] ?? MAKE_PRIMARY_BY_LANG.en;
}

export function getAutonym(code: string): string {
    return (AUTONYM_BY_LANG as Record<string, string>)[code] ?? code;
}

/** Legacy-friendly shim for existing imports. */
export const TRANSLATIONS = {
    getWelcomeLabel,
    getMakePrimaryLabel,
    getAutonym,
} as const;

export type TranslationKey = "welcome" | "makePrimary" | "autonym";
