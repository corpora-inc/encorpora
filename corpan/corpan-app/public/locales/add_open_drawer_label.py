#!/usr/bin/env python3
"""
Phrase-pack drawer trigger label — 0.15.1 polish.

Adds one new key per locale:
  - packs.phrasePack.openDrawerLabel — "Browse phrase packs"
    (count is rendered as a separate pill on the button now)

Idempotent — re-running only fills the missing key, leaves existing
translations untouched.

Run:
    python3 public/locales/add_open_drawer_label.py public/locales/
"""
import json
import os
import sys


TRANSLATIONS: dict[str, dict[str, str]] = {
    "en": {"packs.phrasePack.openDrawerLabel": "Browse phrase packs"},
    "es": {"packs.phrasePack.openDrawerLabel": "Explorar paquetes de frases"},
    "ca": {"packs.phrasePack.openDrawerLabel": "Explora paquets de frases"},
    "fr": {"packs.phrasePack.openDrawerLabel": "Parcourir les packs de phrases"},
    "it": {"packs.phrasePack.openDrawerLabel": "Sfoglia i pacchetti di frasi"},
    "pt-BR": {"packs.phrasePack.openDrawerLabel": "Explorar pacotes de frases"},
    "pt-PT": {"packs.phrasePack.openDrawerLabel": "Explorar pacotes de frases"},
    "ro": {"packs.phrasePack.openDrawerLabel": "Răsfoiește pachete de fraze"},
    "de": {"packs.phrasePack.openDrawerLabel": "Phrasen-Pakete durchsuchen"},
    "nl": {"packs.phrasePack.openDrawerLabel": "Frasenpakketten verkennen"},
    "sv": {"packs.phrasePack.openDrawerLabel": "Bläddra bland fraspaket"},
    "da": {"packs.phrasePack.openDrawerLabel": "Gennemse frasepakker"},
    "no": {"packs.phrasePack.openDrawerLabel": "Bla i frasepakker"},
    "fi": {"packs.phrasePack.openDrawerLabel": "Selaa fraasipaketteja"},
    "pl": {"packs.phrasePack.openDrawerLabel": "Przeglądaj paczki fraz"},
    "cs": {"packs.phrasePack.openDrawerLabel": "Procházet balíčky frází"},
    "sk": {"packs.phrasePack.openDrawerLabel": "Prehľadávať balíky fráz"},
    "sl": {"packs.phrasePack.openDrawerLabel": "Brskaj po paketih fraz"},
    "hr": {"packs.phrasePack.openDrawerLabel": "Pregledaj pakete fraza"},
    "sr": {"packs.phrasePack.openDrawerLabel": "Прегледај пакете фраза"},
    "bg": {"packs.phrasePack.openDrawerLabel": "Разгледай пакети с фрази"},
    "uk": {"packs.phrasePack.openDrawerLabel": "Перегляд пакетів фраз"},
    "ru": {"packs.phrasePack.openDrawerLabel": "Обзор пакетов фраз"},
    "lt": {"packs.phrasePack.openDrawerLabel": "Naršyti frazių paketus"},
    "el": {"packs.phrasePack.openDrawerLabel": "Περιήγηση πακέτων φράσεων"},
    "hu": {"packs.phrasePack.openDrawerLabel": "Kifejezéscsomagok böngészése"},
    "tr": {"packs.phrasePack.openDrawerLabel": "Cümle paketlerine göz at"},
    "ar": {"packs.phrasePack.openDrawerLabel": "تصفح حزم العبارات"},
    "he": {"packs.phrasePack.openDrawerLabel": "עיון בחבילות ביטויים"},
    "fa": {"packs.phrasePack.openDrawerLabel": "مرور بسته‌های عبارات"},
    "hi": {"packs.phrasePack.openDrawerLabel": "फ्रेज़ पैक ब्राउज़ करें"},
    "mr": {"packs.phrasePack.openDrawerLabel": "फ्रेज पॅक ब्राउझ करा"},
    "ne": {"packs.phrasePack.openDrawerLabel": "फ्रेज प्याक हेर्नुहोस्"},
    "bn": {"packs.phrasePack.openDrawerLabel": "ফ্রেজ প্যাক ব্রাউজ করুন"},
    "gu": {"packs.phrasePack.openDrawerLabel": "ફ્રેઝ પેક બ્રાઉઝ કરો"},
    "kn": {"packs.phrasePack.openDrawerLabel": "ಫ್ರೇಸ್ ಪ್ಯಾಕ್‌ಗಳನ್ನು ಬ್ರೌಸ್ ಮಾಡಿ"},
    "ta": {"packs.phrasePack.openDrawerLabel": "சொற்றொடர் தொகுப்புகளைப் பார்க்க"},
    "te": {"packs.phrasePack.openDrawerLabel": "ఫ్రేజ్ ప్యాక్‌లను బ్రౌజ్ చేయి"},
    "ur": {"packs.phrasePack.openDrawerLabel": "فریز پیک براؤز کریں"},
    "pa-Arab": {"packs.phrasePack.openDrawerLabel": "فریز پیک ویکھو"},
    "pa-Guru": {"packs.phrasePack.openDrawerLabel": "ਫ੍ਰੇਜ਼ ਪੈਕ ਵੇਖੋ"},
    "zh-Hans": {"packs.phrasePack.openDrawerLabel": "浏览短语包"},
    "zh-Hant": {"packs.phrasePack.openDrawerLabel": "瀏覽片語包"},
    "yue-Hant-HK": {"packs.phrasePack.openDrawerLabel": "瀏覽片語包"},
    "ja": {"packs.phrasePack.openDrawerLabel": "フレーズパックを見る"},
    "ko-polite": {"packs.phrasePack.openDrawerLabel": "구문 팩 둘러보기"},
    "vi": {"packs.phrasePack.openDrawerLabel": "Duyệt gói cụm từ"},
    "th": {"packs.phrasePack.openDrawerLabel": "เรียกดูชุดวลี"},
    "id": {"packs.phrasePack.openDrawerLabel": "Jelajahi paket frasa"},
    "ms": {"packs.phrasePack.openDrawerLabel": "Lihat pek frasa"},
    "sw": {"packs.phrasePack.openDrawerLabel": "Vinjari pakiti za misemo"},
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
