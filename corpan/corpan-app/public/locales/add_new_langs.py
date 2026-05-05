#!/usr/bin/env python3
"""
Add localized display names for the 13 newly-supported languages
to languages.<code> and dialects.<code> in every locales/*/common.json.

Languages added: ne, pt-PT, hr, sr, uk, bg, ro, ca, yue-Hant-HK, cs, lt, sk, sl

Idempotent: existing non-empty values are not overwritten.

Usage (run from corpan-app/public/locales):
    python3 add_new_langs.py
"""

import json
from pathlib import Path


# For each new code, a mapping from locale folder → localized label.
# Locales not listed fall back to the English name.
NEW_LANG_LABELS: dict[str, dict[str, str]] = {
    "ne": {
        "en": "Nepali",
        "ne": "नेपाली",
        "es": "nepalí",
        "fr": "népalais",
        "de": "Nepali",
        "it": "nepalese",
        "pt-BR": "nepali",
        "ja": "ネパール語",
        "zh-Hans": "尼泊尔语",
        "zh-Hant": "尼泊爾語",
        "ar": "النيبالية",
        "ru": "непальский",
        "hi": "नेपाली",
        "ko-polite": "네팔어",
        "pl": "nepalski",
        "tr": "Nepalce",
        "vi": "Tiếng Nepal",
        "id": "bahasa Nepal",
        "ms": "bahasa Nepal",
        "th": "ภาษาเนปาล",
        "fa": "نپالی",
        "bn": "নেপালি",
        "he": "נפאלית",
        "el": "Νεπαλέζικα",
    },
    "pt-PT": {
        "en": "Portuguese (European)",
        "pt-BR": "Português (Europeu)",
        "es": "portugués (europeo)",
        "fr": "portugais (européen)",
        "de": "Portugiesisch (Europäisch)",
        "it": "portoghese (europeo)",
        "ja": "ポルトガル語（ヨーロッパ）",
        "zh-Hans": "葡萄牙语（欧洲）",
        "zh-Hant": "葡萄牙語（歐洲）",
        "ar": "البرتغالية (الأوروبية)",
        "ru": "португальский (европейский)",
        "hi": "पुर्तगाली (यूरोपीय)",
        "ko-polite": "포르투갈어 (유럽)",
        "tr": "Portekizce (Avrupa)",
        "pl": "portugalski (europejski)",
        "vi": "Tiếng Bồ Đào Nha (Châu Âu)",
        "id": "Portugis (Eropa)",
        "ms": "Portugis (Eropah)",
        "th": "ภาษาโปรตุเกส (ยุโรป)",
        "fa": "پرتغالی (اروپایی)",
        "bn": "পর্তুগিজ (ইউরোপীয়)",
        "el": "Πορτογαλικά (Ευρώπης)",
    },
    "hr": {
        "en": "Croatian",
        "hr": "hrvatski",
        "es": "croata",
        "fr": "croate",
        "de": "Kroatisch",
        "it": "croato",
        "pt-BR": "croata",
        "ja": "クロアチア語",
        "zh-Hans": "克罗地亚语",
        "zh-Hant": "克羅埃西亞語",
        "ar": "الكرواتية",
        "ru": "хорватский",
        "hi": "क्रोएशियाई",
        "ko-polite": "크로아티아어",
        "pl": "chorwacki",
        "tr": "Hırvatça",
        "vi": "Tiếng Croatia",
        "id": "bahasa Kroasia",
        "el": "Κροατικά",
    },
    "sr": {
        "en": "Serbian",
        "sr": "српски",
        "es": "serbio",
        "fr": "serbe",
        "de": "Serbisch",
        "it": "serbo",
        "pt-BR": "sérvio",
        "ja": "セルビア語",
        "zh-Hans": "塞尔维亚语",
        "zh-Hant": "塞爾維亞語",
        "ar": "الصربية",
        "ru": "сербский",
        "hi": "सर्बियाई",
        "ko-polite": "세르비아어",
        "pl": "serbski",
        "tr": "Sırpça",
        "vi": "Tiếng Serbia",
        "id": "bahasa Serbia",
        "el": "Σερβικά",
    },
    "uk": {
        "en": "Ukrainian",
        "uk": "українська",
        "es": "ucraniano",
        "fr": "ukrainien",
        "de": "Ukrainisch",
        "it": "ucraino",
        "pt-BR": "ucraniano",
        "ja": "ウクライナ語",
        "zh-Hans": "乌克兰语",
        "zh-Hant": "烏克蘭語",
        "ar": "الأوكرانية",
        "ru": "украинский",
        "hi": "यूक्रेनी",
        "ko-polite": "우크라이나어",
        "pl": "ukraiński",
        "tr": "Ukraynaca",
        "vi": "Tiếng Ukraina",
        "id": "bahasa Ukraina",
        "el": "Ουκρανικά",
    },
    "bg": {
        "en": "Bulgarian",
        "bg": "български",
        "es": "búlgaro",
        "fr": "bulgare",
        "de": "Bulgarisch",
        "it": "bulgaro",
        "pt-BR": "búlgaro",
        "ja": "ブルガリア語",
        "zh-Hans": "保加利亚语",
        "zh-Hant": "保加利亞語",
        "ar": "البلغارية",
        "ru": "болгарский",
        "hi": "बुल्गारियाई",
        "ko-polite": "불가리아어",
        "pl": "bułgarski",
        "tr": "Bulgarca",
        "vi": "Tiếng Bulgaria",
        "id": "bahasa Bulgaria",
        "el": "Βουλγαρικά",
    },
    "ro": {
        "en": "Romanian",
        "ro": "română",
        "es": "rumano",
        "fr": "roumain",
        "de": "Rumänisch",
        "it": "rumeno",
        "pt-BR": "romeno",
        "ja": "ルーマニア語",
        "zh-Hans": "罗马尼亚语",
        "zh-Hant": "羅馬尼亞語",
        "ar": "الرومانية",
        "ru": "румынский",
        "hi": "रोमानियाई",
        "ko-polite": "루마니아어",
        "pl": "rumuński",
        "tr": "Rumence",
        "vi": "Tiếng Romania",
        "id": "bahasa Rumania",
        "el": "Ρουμανικά",
    },
    "ca": {
        "en": "Catalan",
        "ca": "català",
        "es": "catalán",
        "fr": "catalan",
        "de": "Katalanisch",
        "it": "catalano",
        "pt-BR": "catalão",
        "ja": "カタルーニャ語",
        "zh-Hans": "加泰罗尼亚语",
        "zh-Hant": "加泰隆尼亞語",
        "ar": "الكتالانية",
        "ru": "каталанский",
        "hi": "कातालान",
        "ko-polite": "카탈루냐어",
        "pl": "kataloński",
        "tr": "Katalanca",
        "vi": "Tiếng Catalan",
        "id": "bahasa Katalan",
        "el": "Καταλανικά",
    },
    "yue-Hant-HK": {
        "en": "Cantonese (Traditional)",
        "yue-Hant-HK": "粵語（繁體）",
        "zh-Hant": "粵語（繁體）",
        "zh-Hans": "粤语（繁体）",
        "es": "cantonés (tradicional)",
        "fr": "cantonais (traditionnel)",
        "de": "Kantonesisch (Traditionell)",
        "it": "cantonese (tradizionale)",
        "pt-BR": "cantonês (tradicional)",
        "ja": "広東語（繁体字）",
        "ar": "الكانتونية (التقليدية)",
        "ru": "кантонский (традиционный)",
        "hi": "कैंटोनीज़ (पारंपरिक)",
        "ko-polite": "광둥어 (번체)",
        "pl": "kantoński (tradycyjny)",
        "tr": "Kantonca (Geleneksel)",
        "vi": "Tiếng Quảng Đông (Phồn thể)",
        "id": "Kanton (Tradisional)",
        "el": "Καντονέζικα (Παραδοσιακά)",
    },
    "cs": {
        "en": "Czech",
        "cs": "čeština",
        "es": "checo",
        "fr": "tchèque",
        "de": "Tschechisch",
        "it": "ceco",
        "pt-BR": "tcheco",
        "ja": "チェコ語",
        "zh-Hans": "捷克语",
        "zh-Hant": "捷克語",
        "ar": "التشيكية",
        "ru": "чешский",
        "hi": "चेक",
        "ko-polite": "체코어",
        "pl": "czeski",
        "tr": "Çekçe",
        "vi": "Tiếng Séc",
        "id": "bahasa Ceska",
        "el": "Τσεχικά",
    },
    "lt": {
        "en": "Lithuanian",
        "lt": "lietuvių",
        "es": "lituano",
        "fr": "lituanien",
        "de": "Litauisch",
        "it": "lituano",
        "pt-BR": "lituano",
        "ja": "リトアニア語",
        "zh-Hans": "立陶宛语",
        "zh-Hant": "立陶宛語",
        "ar": "الليتوانية",
        "ru": "литовский",
        "hi": "लिथुआनियाई",
        "ko-polite": "리투아니아어",
        "pl": "litewski",
        "tr": "Litvanca",
        "vi": "Tiếng Litva",
        "id": "bahasa Lituania",
        "el": "Λιθουανικά",
    },
    "sk": {
        "en": "Slovak",
        "sk": "slovenčina",
        "es": "eslovaco",
        "fr": "slovaque",
        "de": "Slowakisch",
        "it": "slovacco",
        "pt-BR": "eslovaco",
        "ja": "スロバキア語",
        "zh-Hans": "斯洛伐克语",
        "zh-Hant": "斯洛伐克語",
        "ar": "السلوفاكية",
        "ru": "словацкий",
        "hi": "स्लोवाक",
        "ko-polite": "슬로바키아어",
        "pl": "słowacki",
        "tr": "Slovakça",
        "vi": "Tiếng Slovakia",
        "id": "bahasa Slovakia",
        "el": "Σλοβακικά",
    },
    "sl": {
        "en": "Slovenian",
        "sl": "slovenščina",
        "es": "esloveno",
        "fr": "slovène",
        "de": "Slowenisch",
        "it": "sloveno",
        "pt-BR": "esloveno",
        "ja": "スロベニア語",
        "zh-Hans": "斯洛文尼亚语",
        "zh-Hant": "斯洛維尼亞語",
        "ar": "السلوفينية",
        "ru": "словенский",
        "hi": "स्लोवेनियाई",
        "ko-polite": "슬로베니아어",
        "pl": "słoweński",
        "tr": "Slovence",
        "vi": "Tiếng Slovenia",
        "id": "bahasa Slovenia",
        "el": "Σλοβενικά",
    },
}


def _needs_write(obj: dict, key_path: list[str]) -> bool:
    cur = obj
    for k in key_path[:-1]:
        v = cur.get(k)
        if not isinstance(v, dict):
            return True
        cur = v
    leaf_key = key_path[-1]
    existing = cur.get(leaf_key)
    return not (isinstance(existing, str) and existing.strip())


def _set_value(obj: dict, key_path: list[str], value: str) -> None:
    cur = obj
    for k in key_path[:-1]:
        if not isinstance(cur.get(k), dict):
            cur[k] = {}
        cur = cur[k]
    cur[key_path[-1]] = value


def main():
    root = Path(__file__).resolve().parent
    counters = {code: {"updated": 0, "skipped": 0} for code in NEW_LANG_LABELS}

    for locale_dir in sorted(root.iterdir()):
        if not locale_dir.is_dir():
            continue
        if locale_dir.name in {".git", "__pycache__"}:
            continue

        common_path = locale_dir / "common.json"
        if not common_path.exists():
            continue

        try:
            data = json.loads(common_path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[WARN] Could not read {common_path}: {e}")
            continue

        for new_code, label_map in NEW_LANG_LABELS.items():
            label = label_map.get(locale_dir.name, label_map["en"])
            for top in ("languages", "dialects"):
                if _needs_write(data, [top, new_code]):
                    _set_value(data, [top, new_code], label)
                    counters[new_code]["updated"] += 1
                else:
                    counters[new_code]["skipped"] += 1

        try:
            common_path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        except Exception as e:
            print(f"[ERROR] Failed to write {common_path}: {e}")

    print("\nDone.")
    for code, c in counters.items():
        print(f"  {code}: updated {c['updated']}, skipped {c['skipped']}")


if __name__ == "__main__":
    main()
