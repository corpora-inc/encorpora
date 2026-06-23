#!/usr/bin/env python3
"""
Phrase-pack browser collapse/expand affordance — 0.15.1 polish.

Adds two new keys per locale:
  - packs.phrasePack.showAll      — "Show all ({{count}})"
  - packs.phrasePack.collapseList — "Show less"

Idempotent — re-running only fills missing keys, leaves existing
translations untouched.

Run:
    python3 public/locales/add_phrase_pack_show_all.py public/locales/
"""
import json
import os
import sys


TRANSLATIONS: dict[str, dict[str, str]] = {
    "en": {
        "packs.phrasePack.showAll": "Show all ({{count}})",
        "packs.phrasePack.collapseList": "Show less",
    },
    "es": {
        "packs.phrasePack.showAll": "Mostrar todos ({{count}})",
        "packs.phrasePack.collapseList": "Mostrar menos",
    },
    "ca": {
        "packs.phrasePack.showAll": "Mostra-ho tot ({{count}})",
        "packs.phrasePack.collapseList": "Mostra menys",
    },
    "fr": {
        "packs.phrasePack.showAll": "Tout afficher ({{count}})",
        "packs.phrasePack.collapseList": "Afficher moins",
    },
    "it": {
        "packs.phrasePack.showAll": "Mostra tutti ({{count}})",
        "packs.phrasePack.collapseList": "Mostra meno",
    },
    "pt-BR": {
        "packs.phrasePack.showAll": "Mostrar todos ({{count}})",
        "packs.phrasePack.collapseList": "Mostrar menos",
    },
    "pt-PT": {
        "packs.phrasePack.showAll": "Mostrar todos ({{count}})",
        "packs.phrasePack.collapseList": "Mostrar menos",
    },
    "ro": {
        "packs.phrasePack.showAll": "Arată toate ({{count}})",
        "packs.phrasePack.collapseList": "Arată mai puțin",
    },
    "de": {
        "packs.phrasePack.showAll": "Alle anzeigen ({{count}})",
        "packs.phrasePack.collapseList": "Weniger anzeigen",
    },
    "nl": {
        "packs.phrasePack.showAll": "Alle tonen ({{count}})",
        "packs.phrasePack.collapseList": "Minder tonen",
    },
    "sv": {
        "packs.phrasePack.showAll": "Visa alla ({{count}})",
        "packs.phrasePack.collapseList": "Visa färre",
    },
    "da": {
        "packs.phrasePack.showAll": "Vis alle ({{count}})",
        "packs.phrasePack.collapseList": "Vis færre",
    },
    "no": {
        "packs.phrasePack.showAll": "Vis alle ({{count}})",
        "packs.phrasePack.collapseList": "Vis færre",
    },
    "fi": {
        "packs.phrasePack.showAll": "Näytä kaikki ({{count}})",
        "packs.phrasePack.collapseList": "Näytä vähemmän",
    },
    "pl": {
        "packs.phrasePack.showAll": "Pokaż wszystkie ({{count}})",
        "packs.phrasePack.collapseList": "Pokaż mniej",
    },
    "cs": {
        "packs.phrasePack.showAll": "Zobrazit vše ({{count}})",
        "packs.phrasePack.collapseList": "Zobrazit méně",
    },
    "sk": {
        "packs.phrasePack.showAll": "Zobraziť všetko ({{count}})",
        "packs.phrasePack.collapseList": "Zobraziť menej",
    },
    "sl": {
        "packs.phrasePack.showAll": "Pokaži vse ({{count}})",
        "packs.phrasePack.collapseList": "Pokaži manj",
    },
    "hr": {
        "packs.phrasePack.showAll": "Prikaži sve ({{count}})",
        "packs.phrasePack.collapseList": "Prikaži manje",
    },
    "sr": {
        "packs.phrasePack.showAll": "Прикажи све ({{count}})",
        "packs.phrasePack.collapseList": "Прикажи мање",
    },
    "bg": {
        "packs.phrasePack.showAll": "Покажи всички ({{count}})",
        "packs.phrasePack.collapseList": "Покажи по-малко",
    },
    "uk": {
        "packs.phrasePack.showAll": "Показати всі ({{count}})",
        "packs.phrasePack.collapseList": "Показати менше",
    },
    "ru": {
        "packs.phrasePack.showAll": "Показать все ({{count}})",
        "packs.phrasePack.collapseList": "Показать меньше",
    },
    "lt": {
        "packs.phrasePack.showAll": "Rodyti visus ({{count}})",
        "packs.phrasePack.collapseList": "Rodyti mažiau",
    },
    "el": {
        "packs.phrasePack.showAll": "Εμφάνιση όλων ({{count}})",
        "packs.phrasePack.collapseList": "Εμφάνιση λιγότερων",
    },
    "hu": {
        "packs.phrasePack.showAll": "Összes megjelenítése ({{count}})",
        "packs.phrasePack.collapseList": "Kevesebb megjelenítése",
    },
    "tr": {
        "packs.phrasePack.showAll": "Tümünü göster ({{count}})",
        "packs.phrasePack.collapseList": "Daha az göster",
    },
    "ar": {
        "packs.phrasePack.showAll": "عرض الكل ({{count}})",
        "packs.phrasePack.collapseList": "عرض أقل",
    },
    "he": {
        "packs.phrasePack.showAll": "הצג הכול ({{count}})",
        "packs.phrasePack.collapseList": "הצג פחות",
    },
    "fa": {
        "packs.phrasePack.showAll": "نمایش همه ({{count}})",
        "packs.phrasePack.collapseList": "نمایش کمتر",
    },
    "hi": {
        "packs.phrasePack.showAll": "सभी दिखाएँ ({{count}})",
        "packs.phrasePack.collapseList": "कम दिखाएँ",
    },
    "mr": {
        "packs.phrasePack.showAll": "सर्व दाखवा ({{count}})",
        "packs.phrasePack.collapseList": "कमी दाखवा",
    },
    "ne": {
        "packs.phrasePack.showAll": "सबै देखाउनुहोस् ({{count}})",
        "packs.phrasePack.collapseList": "थोरै देखाउनुहोस्",
    },
    "bn": {
        "packs.phrasePack.showAll": "সব দেখান ({{count}})",
        "packs.phrasePack.collapseList": "কম দেখান",
    },
    "gu": {
        "packs.phrasePack.showAll": "બધા બતાવો ({{count}})",
        "packs.phrasePack.collapseList": "ઓછું બતાવો",
    },
    "kn": {
        "packs.phrasePack.showAll": "ಎಲ್ಲ ತೋರಿಸು ({{count}})",
        "packs.phrasePack.collapseList": "ಕಡಿಮೆ ತೋರಿಸು",
    },
    "ta": {
        "packs.phrasePack.showAll": "அனைத்தையும் காட்டு ({{count}})",
        "packs.phrasePack.collapseList": "குறைந்தவை காட்டு",
    },
    "te": {
        "packs.phrasePack.showAll": "అన్నీ చూపించు ({{count}})",
        "packs.phrasePack.collapseList": "తక్కువ చూపించు",
    },
    "ur": {
        "packs.phrasePack.showAll": "سب دکھائیں ({{count}})",
        "packs.phrasePack.collapseList": "کم دکھائیں",
    },
    "pa-Arab": {
        "packs.phrasePack.showAll": "ساریاں ویکھاؤ ({{count}})",
        "packs.phrasePack.collapseList": "گھٹ ویکھاؤ",
    },
    "pa-Guru": {
        "packs.phrasePack.showAll": "ਸਾਰੇ ਵਿਖਾਓ ({{count}})",
        "packs.phrasePack.collapseList": "ਘੱਟ ਵਿਖਾਓ",
    },
    "zh-Hans": {
        "packs.phrasePack.showAll": "显示全部 ({{count}})",
        "packs.phrasePack.collapseList": "收起",
    },
    "zh-Hant": {
        "packs.phrasePack.showAll": "顯示全部 ({{count}})",
        "packs.phrasePack.collapseList": "收起",
    },
    "yue-Hant-HK": {
        "packs.phrasePack.showAll": "顯示全部 ({{count}})",
        "packs.phrasePack.collapseList": "收埋",
    },
    "ja": {
        "packs.phrasePack.showAll": "すべて表示 ({{count}})",
        "packs.phrasePack.collapseList": "折りたたむ",
    },
    "ko-polite": {
        "packs.phrasePack.showAll": "모두 보기 ({{count}})",
        "packs.phrasePack.collapseList": "접기",
    },
    "vi": {
        "packs.phrasePack.showAll": "Hiện tất cả ({{count}})",
        "packs.phrasePack.collapseList": "Thu gọn",
    },
    "th": {
        "packs.phrasePack.showAll": "แสดงทั้งหมด ({{count}})",
        "packs.phrasePack.collapseList": "ย่อ",
    },
    "id": {
        "packs.phrasePack.showAll": "Tampilkan semua ({{count}})",
        "packs.phrasePack.collapseList": "Tutup",
    },
    "ms": {
        "packs.phrasePack.showAll": "Tunjukkan semua ({{count}})",
        "packs.phrasePack.collapseList": "Tunjukkan kurang",
    },
    "sw": {
        "packs.phrasePack.showAll": "Onyesha zote ({{count}})",
        "packs.phrasePack.collapseList": "Onyesha kidogo",
    },
}


def deep_set(d: dict, dotted_key: str, value):
    parts = dotted_key.split(".")
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    leaf = parts[-1]
    if leaf not in cur:
        cur[leaf] = value


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path, data):
    if isinstance(data, dict) and "$schema" in data:
        ordered = {"$schema": data["$schema"]}
        for k, v in data.items():
            if k == "$schema":
                continue
            ordered[k] = v
        data = ordered
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    if not os.path.isdir(root):
        print(f"Not a directory: {root}")
        sys.exit(1)

    fallback = TRANSLATIONS["en"]
    changed = 0
    for lang_dir in sorted(os.listdir(root)):
        lang_path = os.path.join(root, lang_dir)
        if not os.path.isdir(lang_path):
            continue
        common_path = os.path.join(lang_path, "common.json")
        if not os.path.isfile(common_path):
            continue
        try:
            data = load_json(common_path)
        except Exception as e:
            print(f"SKIP (invalid JSON): {common_path} -> {e}")
            continue
        if not isinstance(data, dict):
            continue
        keys = TRANSLATIONS.get(lang_dir, fallback)
        for dotted_key, value in keys.items():
            deep_set(data, dotted_key, value)
        dump_json(common_path, data)
        changed += 1
        print(f"Updated: {common_path}  ({lang_dir})  (+{len(keys)})")
    print(f"\nDone. Files updated: {changed}")


if __name__ == "__main__":
    main()
