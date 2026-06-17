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
    sv: "Välkommen",
    no: "Velkommen",
    da: "Velkommen",
    nl: "Welkom",
    pl: "Witamy",
    ru: "Добро пожаловать",
    hu: "Üdvözöljük",
    fi: "Tervetuloa",
    tr: "Hoş geldiniz",
    el: "Καλώς ορίσατε",
    he: "בְּרוּכִים הַבָּאִים",
    ar: "أهلاً وسهلاً",
    fa: "خوش آمدید",
    hi: "स्वागत है",
    bn: "স্বাগতম",
    th: "ยินดีต้อนรับ",
    vi: "Chào mừng",
    id: "Selamat datang",
    jv: "Sugeng rawuh",
    su: "Wilujeng sumping",
    ms: "Selamat datang",
    tl: "Maligayang pagdating",
    sw: "Karibu",
    "zh-Hans": "欢迎",
    "zh-Hant": "歡迎",
    "ko-polite": "환영합니다",
    ja: "ようこそ",
    ta: "வரவேற்பு",
    te: "స్వాగతం",
    kn: "ಸ್ವಾಗತ",
    mr: "स्वागत आहे",
    gu: "સ્વાગત છે",
    "pa-Guru": "ਸਵਾਗਤ ਹੈ",
    "pa-Arab": "خوش آمدید",
    ur: "خوش آمديد",

    // Languages added in 0.12.2 (now shipping)
    ne: "स्वागत छ",
    "pt-PT": "Bem-vindo",
    hr: "Dobrodošli",
    sr: "Добродошли",
    uk: "Ласкаво просимо",
    bg: "Добре дошли",
    ro: "Bun venit",
    ca: "Benvingut",
    cs: "Vítejte",
    lt: "Sveiki atvykę",
    sk: "Vitajte",
    sl: "Dobrodošli",
    "yue-Hant-HK": "歡迎",

    // Coming soon languages
    my: "ကြိုဆိုပါတယ်",
    km: "សូមស្វាគមន៍",
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
    sv: "Svenska",
    no: "Norsk",
    da: "Dansk",
    nl: "Nederlands",
    pl: "Polski",
    ru: "Русский",
    hu: "Magyar",
    fi: "Suomi",
    tr: "Türkçe",
    el: "Ελληνικά",
    he: "עִבְרִית",
    ar: "العربية",
    fa: "فارسی",
    hi: "हिन्दी",
    bn: "বাংলা",
    th: "ไทย",
    vi: "Tiếng Việt",
    id: "Bahasa Indonesia",
    jv: "Basa Jawa",
    su: "Basa Sunda",
    ms: "Bahasa Melayu",
    tl: "Tagalog",
    sw: "Kiswahili",
    "zh-Hans": "中文（简体）",
    "zh-Hant": "中文（繁體）",
    "ko-polite": "한국어 (존댓말)",
    ja: "日本語",
    ta: "தமிழ்",
    te: "తెలుగు",
    kn: "ಕನ್ನಡ",
    mr: "मराठी",
    gu: "ગુજરાતી",
    "pa-Guru": "ਪੰਜਾਬੀ",
    "pa-Arab": "پنجابی",
    ur: "اردو",

    // Languages added in 0.12.2 (now shipping) — Slavic / Balkan / Eastern Europe / Romance / Sinitic / Nepali
    uk: "Українська",
    ro: "Română",
    cs: "Čeština",
    sk: "Slovenčina",
    sl: "Slovenščina",
    sr: "Српски",
    hr: "Hrvatski",
    bg: "Български",
    lt: "Lietuvių",
    "pt-PT": "Português (Europa)",
    ca: "Català",
    ne: "नेपाली",

    // Coming soon languages
    // Indian subcontinent
    ml: "മലയാളം",
    si: "සිංහල",
    // SE Asian
    fil: "Filipino",
    my: "မြန်မာဘာသာ",
    km: "ខ្មែរ",
    // Africa
    af: "Afrikaans",
    ha: "Hausa",
    // Caucasus
    hy: "Հայերեն",
    ka: "ქართული",
    // Sinitic
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
    it: "Imposta l'italiano come lingua principale",
    "pt-BR": "Tornar o português meu idioma principal",
    de: "Deutsch als meine Hauptsprache festlegen",
    sv: "Gör svenska till mitt primära språk",
    no: "Gjør norsk til hovedspråket mitt",
    da: "Gør dansk til mit primære sprog",
    nl: "Maak Nederlands mijn primaire taal",
    pl: "Ustaw polski jako mój język główny",
    ru: "Сделать русский основным языком",
    hu: "A magyart állítsa be elsődleges nyelvnek",
    fi: "Tee suomesta pääkieleni",
    tr: "Türkçeyi birincil dilim olarak ayarla",
    el: "Κάνε τα ελληνικά την κύρια γλώσσα μου",
    he: "הַגְדֵּר עִבְרִית כִּשְׂפָתִי הָרָאשִׁית",
    ar: "اجعل العربية لغتي الرئيسية",
    fa: "فارسی را زبان اصلی من کن",
    hi: "हिंदी को मेरी मुख्य भाषा बनाएं",
    bn: "বাংলাকে আমার প্রধান ভাষা করুন",
    th: "ตั้งค่าไทยเป็นภาษาหลักของฉัน",
    vi: "Đặt tiếng Việt làm ngôn ngữ chính của tôi",
    id: "Jadikan Bahasa Indonesia bahasa utama saya",
    jv: "Dadekake basa Jawa minangka basa utamaku",
    su: "Jadikeun basa Sunda jadi basa utama abdi",
    ms: "Jadikan Bahasa Melayu sebagai bahasa utama saya",
    tl: "Gawing pangunahing wika ko ang Tagalog",
    sw: "Fanya Kiswahili kuwa lugha yangu kuu",
    "zh-Hans": "将简体中文设为我的主要语言",
    "zh-Hant": "將繁體中文設為我的主要語言",
    "ko-polite": "한국어를 기본 언어로 설정하기",
    ja: "日本語を主言語にする",
    ta: "தமிழை எனது முதன்மை மொழியாக அமைக்கவும்",
    te: "తెలుగును నా ప్రాథమిక భాషగా చేయండి",
    kn: "ಕನ್ನಡವನ್ನು ನನ್ನ ಪ್ರಾಥಮಿಕ ಭಾಷೆಯನ್ನಾಗಿ ಮಾಡಿ",
    mr: "मराठीला माझी प्राथमिक भाषा करा",
    gu: "ગુજરાતીને મારી પ્રાથમિક ભાષા બનાવો",
    "pa-Guru": "ਪੰਜਾਬੀ ਨੂੰ ਮੇਰੀ ਮੁੱਖ ਭਾਸ਼ਾ ਬਣਾਓ",
    "pa-Arab": "پنجابی کو میری بنیادی زبان بنائیں",
    ur: "اردو کو میری بنیادی زبان بنائیں",

    // Languages added in 0.12.2
    ne: "नेपालीलाई मेरो प्राथमिक भाषा बनाउनुहोस्",
    "pt-PT": "Definir o português (europeu) como a minha língua principal",
    hr: "Postavi hrvatski kao moj primarni jezik",
    sr: "Постави српски као мој основни језик",
    uk: "Зробити українську моєю основною мовою",
    bg: "Направи българския мой основен език",
    ro: "Setează româna ca limba mea principală",
    ca: "Defineix el català com a llengua principal",
    "yue-Hant-HK": "將粵語設為我嘅主要語言",
    cs: "Nastavit češtinu jako můj hlavní jazyk",
    lt: "Padaryti lietuvių mano pagrindine kalba",
    sk: "Nastaviť slovenčinu ako môj hlavný jazyk",
    sl: "Nastavi slovenščino kot moj glavni jezik",
} as const;
export type MakePrimaryCode = keyof typeof MAKE_PRIMARY_BY_LANG;

/**
 * “Coming soon” in each language (used for non-clickable coming-soon cards).
 * The autonym is rendered separately as the headline.
 */
export const COMING_SOON_BY_LANG = {
    // Slavic / Balkan / Eastern Europe
    uk: "Скоро з'явиться",
    ro: "În curând",
    cs: "Již brzy",
    sk: "Už čoskoro",
    sr: "Ускоро",
    hr: "Uskoro",
    bg: "Очаквайте скоро",
    // Indian subcontinent
    ml: "ഉടൻ വരുന്നു",
    ne: "चाँडै आउँदै",
    si: "ඉක්මනින් එනවා",
    // SE Asian
    fil: "Malapit na",
    my: "မကြာမီလာပါမည်",
    km: "មកដល់ឆាប់ៗនេះ",
    // Africa
    af: "Binnekort beskikbaar",
    ha: "Ba da daɗewa ba",
    // Caucasus
    hy: "Շուտով",
    ka: "მალე",
    // Sinitic
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
