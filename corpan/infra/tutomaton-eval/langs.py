"""Tutomaton teaching-language table for the qwen3-4B parameter bake-off.

Single source of truth for the eval harness. One row per language the pack
advertises in `packs/tutomaton/manifest.json` (55 teaching languages).

Each row ties our code to:
  - `name`   : English name (for the English system-prompt variant).
  - `native` : endonym in the target script (for the target-language prompt
               variant — the #1 hypothesis for weak non-Latin langs).
  - `scripts`: the Unicode script blocks an answer is ALLOWED to be written in.
               This is the objective, dependency-free "did it stay in the
               language's writing system" gate. A set, because some langs admit
               more than one (Serbian: Cyrillic OR Latin; Japanese: kana+han;
               every lang tolerates a little Latin for loanwords/punctuation).
  - `ft`     : fasttext lid.176 label that output SHOULD detect as, or None when
               lid.176 has no matching label (then we fall back to script-only).
               Disambiguates same-script langs (hi/mr/ne, es/it, ru/uk/bg).
  - `rtl`    : right-to-left (rendering only; not used for scoring).

`scripts` values name keys in metrics.SCRIPTS (Unicode range tables).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Lang:
    code: str
    name: str
    native: str
    scripts: tuple[str, ...]
    ft: str | None
    rtl: bool = False


# Latin-script European + SEA + African langs (script gate is weak here, so the
# fasttext label does the real disambiguation work).
LANGS: list[Lang] = [
    # --- Latin script ---
    Lang("en", "English", "English", ("latin",), "en"),
    Lang("es", "Spanish", "Español", ("latin",), "es"),
    Lang("fr", "French", "Français", ("latin",), "fr"),
    Lang("de", "German", "Deutsch", ("latin",), "de"),
    Lang("it", "Italian", "Italiano", ("latin",), "it"),
    Lang("pt-BR", "Portuguese (Brazilian)", "Português (Brasil)", ("latin",), "pt"),
    Lang("pt-PT", "Portuguese (European)", "Português (Portugal)", ("latin",), "pt"),
    Lang("nl", "Dutch", "Nederlands", ("latin",), "nl"),
    Lang("ca", "Catalan", "Català", ("latin",), "ca"),
    Lang("ro", "Romanian", "Română", ("latin",), "ro"),
    Lang("pl", "Polish", "Polski", ("latin",), "pl"),
    Lang("cs", "Czech", "Čeština", ("latin",), "cs"),
    Lang("sk", "Slovak", "Slovenčina", ("latin",), "sk"),
    Lang("sl", "Slovenian", "Slovenščina", ("latin",), "sl"),
    Lang("hr", "Croatian", "Hrvatski", ("latin",), "hr"),
    Lang("hu", "Hungarian", "Magyar", ("latin",), "hu"),
    Lang("lt", "Lithuanian", "Lietuvių", ("latin",), "lt"),
    Lang("sv", "Swedish", "Svenska", ("latin",), "sv"),
    Lang("da", "Danish", "Dansk", ("latin",), "da"),
    Lang("no", "Norwegian", "Norsk", ("latin",), "no"),
    Lang("fi", "Finnish", "Suomi", ("latin",), "fi"),
    Lang("tr", "Turkish", "Türkçe", ("latin",), "tr"),
    Lang("vi", "Vietnamese", "Tiếng Việt", ("latin",), "vi"),
    Lang("id", "Indonesian", "Bahasa Indonesia", ("latin",), "id"),
    Lang("ms", "Malay", "Bahasa Melayu", ("latin",), "ms"),
    Lang("jv", "Javanese", "Basa Jawa", ("latin",), "jv"),
    Lang("su", "Sundanese", "Basa Sunda", ("latin",), "su"),
    Lang("tl", "Tagalog", "Tagalog", ("latin",), "tl"),
    Lang("sw", "Swahili", "Kiswahili", ("latin",), "sw"),
    # --- Cyrillic ---
    Lang("ru", "Russian", "Русский", ("cyrillic",), "ru"),
    Lang("uk", "Ukrainian", "Українська", ("cyrillic",), "uk"),
    Lang("bg", "Bulgarian", "Български", ("cyrillic",), "bg"),
    # Serbian is digraphic — Cyrillic is the prompt target, Latin is valid too.
    Lang("sr", "Serbian", "Српски", ("cyrillic", "latin"), "sr"),
    # --- Greek ---
    Lang("el", "Greek", "Ελληνικά", ("greek",), "el"),
    # --- CJK / non-spaced ---
    Lang("zh", "Mandarin Chinese", "普通话", ("han",), "zh"),
    Lang("zh-Hans", "Chinese (Simplified)", "简体中文", ("han",), "zh"),
    Lang("zh-Hant", "Chinese (Traditional)", "繁體中文", ("han",), "zh"),
    Lang("yue-Hant-HK", "Cantonese (Traditional)", "粵語", ("han",), None),  # lid.176 ~ zh
    Lang("ja", "Japanese", "日本語", ("kana", "han"), "ja"),
    Lang("ko-polite", "Korean (Polite)", "한국어", ("hangul",), "ko"),
    Lang("th", "Thai", "ไทย", ("thai",), "th"),
    # --- Indic (Brahmic scripts — each script uniquely IDs the language) ---
    Lang("hi", "Hindi", "हिन्दी", ("devanagari",), "hi"),
    Lang("mr", "Marathi", "मराठी", ("devanagari",), "mr"),
    Lang("ne", "Nepali", "नेपाली", ("devanagari",), "ne"),
    Lang("bn", "Bengali", "বাংলা", ("bengali",), "bn"),
    Lang("ta", "Tamil", "தமிழ்", ("tamil",), "ta"),
    Lang("te", "Telugu", "తెలుగు", ("telugu",), "te"),
    Lang("gu", "Gujarati", "ગુજરાતી", ("gujarati",), "gu"),
    Lang("kn", "Kannada", "ಕನ್ನಡ", ("kannada",), "kn"),
    Lang("pa-Guru", "Punjabi (Gurmukhi)", "ਪੰਜਾਬੀ", ("gurmukhi",), "pa"),
    # --- RTL ---
    Lang("ar", "Arabic (Standard)", "العربية", ("arabic",), "ar", rtl=True),
    Lang("fa", "Persian", "فارسی", ("arabic",), "fa", rtl=True),
    Lang("ur", "Urdu", "اردو", ("arabic",), "ur", rtl=True),
    Lang("he", "Hebrew", "עברית", ("hebrew",), "he", rtl=True),
    Lang("pa-Arab", "Punjabi (Shahmukhi)", "پنجابی", ("arabic",), None, rtl=True),
]

# Languages whose script is shared by several langs, so script-coverage alone is
# NOT enough — fasttext lid.176 must also confirm the specific language. Brahmic
# / Hangul / Thai / Greek / Hebrew scripts are language-unique, so those pass on
# script alone (more robust on short tutor replies where lid.176 is noisy).
AMBIGUOUS_SCRIPTS = {"latin", "cyrillic", "arabic", "han"}

CODES = [l.code for l in LANGS]


def by_code(code: str) -> Lang | None:
    for l in LANGS:
        if l.code == code:
            return l
    return None
