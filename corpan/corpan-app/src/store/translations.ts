// src/store/translations.ts

/**
 * Minimal translations for onboarding.
 * We keep:
 *  - a "welcome" word per language (for the animated welcome screen)
 *  - a "make primary language" label per language that NAMES THE LANGUAGE
 *  - autonyms (language self-names) for display/fallbacks
 *  - "coming soon" labels for languages we plan to add soon
 */

export const WELCOME_BY_LANG = {
    en: "Welcome",
    es: "Bienvenido",
    fr: "Bienvenue",
    it: "Benvenuto",
    "pt-BR": "Bem-vindo",
    de: "Willkommen",
    pl: "Witamy",
    ru: "Добро пожаловать",
    hu: "Üdvözöljük",
    tr: "Hoş geldiniz",
    ar: "أهلاً وسهلاً",
    fa: "خوش آمدید",
    hi: "स्वागत है",
    bn: "স্বাগতম",
    th: "ยินดีต้อนรับ",
    vi: "Chào mừng",
    id: "Selamat datang",
    "zh-Hans": "欢迎",
    "zh-Hant": "歡迎",
    "ko-polite": "환영합니다",
    ja: "ようこそ",

    // Coming soon languages
    ur: "خوش آمديد",
    ta: "வரவேற்பு",
    te: "స్వాగతం",
    kn: "ಸ್ವಾಗತ",
    mr: "स्वागत आहे",
    gu: "સ્વાગત છે",
    pa: "ਸਵਾਗਤ ਹੈ",
    sw: "Karibu",
    he: "ברוך הבא",
    el: "Καλώς ήρθατε",
    my: "ကြိုဆိုပါတယ်",
    km: "សូមស្វាគមន៍",
    "yue-Hant-HK": "歡迎",
} as const;
export type WelcomeCode = keyof typeof WELCOME_BY_LANG;

/** Autonyms (self-names) for language codes used in onboarding lists. */
export const AUTONYM_BY_LANG = {
    en: "English",
    es: "Español",
    fr: "Français",
    it: "Italiano",
    "pt-BR": "Português (Brasil)",
    de: "Deutsch",
    pl: "Polski",
    ru: "Русский",
    hu: "Magyar",
    tr: "Türkçe",
    ar: "العربية",
    fa: "فارسی",
    hi: "हिन्दी",
    bn: "বাংলা",
    th: "ไทย",
    vi: "Tiếng Việt",
    id: "Bahasa Indonesia",
    "zh-Hans": "中文（简体）",
    "zh-Hant": "中文（繁體）",
    "ko-polite": "한국어 (존댓말)",
    ja: "日本語",

    // Coming soon languages
    ur: "اردو",
    ta: "தமிழ்",
    te: "తెలుగు",
    kn: "ಕನ್ನಡ",
    mr: "मराठी",
    gu: "ગુજરાતી",
    pa: "ਪੰਜਾਬੀ",
    sw: "Kiswahili",
    he: "עברית",
    el: "Ελληνικά",
    my: "မြန်မာဘာသာ",
    km: "ខ្មែរ",
    "yue-Hant-HK": "粵語",
} as const;
export type LanguageCode = keyof typeof AUTONYM_BY_LANG;

/**
 * “Make <Language> my primary language” — each string explicitly names
 * the language (autonym) inside the sentence.
 */
export const MAKE_PRIMARY_BY_LANG = {
    en: "Make English my primary language",
    es: "Hacer que el español sea mi idioma principal",
    fr: "Définir le français comme langue principale",
    it: "Imposta l’italiano come lingua principale",
    "pt-BR": "Tornar o português meu idioma principal",
    de: "Deutsch als meine Hauptsprache festlegen",
    pl: "Ustaw polski jako mój język główny",
    ru: "Сделать русский основным языком",
    hu: "A magyart állítsa be elsődleges nyelvnek",
    tr: "Türkçeyi birincil dilim olarak ayarla",
    ar: "اجعل العربية لغتي الرئيسية",
    fa: "فارسی را زبان اصلی من کن",
    hi: "हिंदी को मेरी मुख्य भाषा बनाएं",
    bn: "বাংলাকে আমার প্রধান ভাষা করুন",
    th: "ตั้งค่าไทยเป็นภาษาหลักของฉัน",
    vi: "Đặt tiếng Việt làm ngôn ngữ chính của tôi",
    id: "Jadikan Bahasa Indonesia bahasa utama saya",
    "zh-Hans": "将简体中文设为我的主要语言",
    "zh-Hant": "將繁體中文設為我的主要語言",
    "ko-polite": "한국어를 기본 언어로 설정하기",
    ja: "日本語を主言語にする",
} as const;
export type MakePrimaryCode = keyof typeof MAKE_PRIMARY_BY_LANG;

/**
 * “Coming soon” in each language (used for non-clickable coming-soon cards).
 * The autonym is rendered separately as the headline.
 */
export const COMING_SOON_BY_LANG = {
    ur: "جلد آ رہی ہے",
    ta: "விரைவில் வருகிறது",
    te: "త్వరలో రానుంది",
    kn: "ಶೀಘ್ರದಲ್ಲೇ ಬರುತ್ತಿದೆ",
    mr: "लवकरच येत आहे",
    gu: "જલ્દી જ આવી રહ્યું છે",
    pa: "ਜਲਦੀ ਹੀ ਆ ਰਿਹਾ ਹੈ",
    sw: "Inakuja hivi karibuni",
    he: "מגיע בקרוב",
    el: "Έρχεται σύντομα",
    my: "မကြာမီလာပါမည်",
    km: "មកដល់ឆាប់ៗនេះ",
    "yue-Hant-HK": "即將推出",
} as const;
export type ComingSoonCode = keyof typeof COMING_SOON_BY_LANG;

/** Safe helpers (work with any string code, fall back gracefully). */
export function getWelcomeLabel(code: string): string {
    return (WELCOME_BY_LANG as Record<string, string>)[code] ?? WELCOME_BY_LANG.en;
}

export function getMakePrimaryLabel(code: string): string {
    return (
        (MAKE_PRIMARY_BY_LANG as Record<string, string>)[code] ??
        MAKE_PRIMARY_BY_LANG.en
    );
}

export function getAutonym(code: string): string {
    return (AUTONYM_BY_LANG as Record<string, string>)[code] ?? code;
}

export function getComingSoonLabel(code: string): string {
    return (COMING_SOON_BY_LANG as Record<string, string>)[code] ?? "Coming soon";
}

/** Legacy-friendly shim for existing imports. */
export const TRANSLATIONS = {
    getWelcomeLabel,
    getMakePrimaryLabel,
    getAutonym,
    getComingSoonLabel,
} as const;

export type TranslationKey = "welcome" | "makePrimary" | "autonym" | "comingSoon";
