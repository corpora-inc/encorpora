#!/usr/bin/env python3
"""
Phrase-pack drawer trigger button — 0.15.1 polish.

Adds one new key per locale:
  - packs.phrasePack.openDrawer — "Browse phrase packs ({{count}})"

Idempotent — re-running only fills the missing key, leaves existing
translations untouched.

Run:
    python3 public/locales/add_phrase_pack_open_drawer.py public/locales/
"""
import json
import os
import sys


TRANSLATIONS: dict[str, dict[str, str]] = {
    "en": {"packs.phrasePack.openDrawer": "Browse phrase packs ({{count}})"},
    "es": {"packs.phrasePack.openDrawer": "Explorar paquetes de frases ({{count}})"},
    "ca": {"packs.phrasePack.openDrawer": "Explora paquets de frases ({{count}})"},
    "fr": {"packs.phrasePack.openDrawer": "Parcourir les packs de phrases ({{count}})"},
    "it": {"packs.phrasePack.openDrawer": "Sfoglia i pacchetti di frasi ({{count}})"},
    "pt-BR": {"packs.phrasePack.openDrawer": "Explorar pacotes de frases ({{count}})"},
    "pt-PT": {"packs.phrasePack.openDrawer": "Explorar pacotes de frases ({{count}})"},
    "ro": {"packs.phrasePack.openDrawer": "Răsfoiește pachete de fraze ({{count}})"},
    "de": {"packs.phrasePack.openDrawer": "Phrasen-Pakete durchsuchen ({{count}})"},
    "nl": {"packs.phrasePack.openDrawer": "Frasenpakketten verkennen ({{count}})"},
    "sv": {"packs.phrasePack.openDrawer": "Bläddra bland fraspaket ({{count}})"},
    "da": {"packs.phrasePack.openDrawer": "Gennemse frasepakker ({{count}})"},
    "no": {"packs.phrasePack.openDrawer": "Bla i frasepakker ({{count}})"},
    "fi": {"packs.phrasePack.openDrawer": "Selaa fraasipaketteja ({{count}})"},
    "pl": {"packs.phrasePack.openDrawer": "Przeglądaj paczki fraz ({{count}})"},
    "cs": {"packs.phrasePack.openDrawer": "Procházet balíčky frází ({{count}})"},
    "sk": {"packs.phrasePack.openDrawer": "Prehľadávať balíky fráz ({{count}})"},
    "sl": {"packs.phrasePack.openDrawer": "Brskaj po paketih fraz ({{count}})"},
    "hr": {"packs.phrasePack.openDrawer": "Pregledaj pakete fraza ({{count}})"},
    "sr": {"packs.phrasePack.openDrawer": "Прегледај пакете фраза ({{count}})"},
    "bg": {"packs.phrasePack.openDrawer": "Разгледай пакети с фрази ({{count}})"},
    "uk": {"packs.phrasePack.openDrawer": "Перегляд пакетів фраз ({{count}})"},
    "ru": {"packs.phrasePack.openDrawer": "Обзор пакетов фраз ({{count}})"},
    "lt": {"packs.phrasePack.openDrawer": "Naršyti frazių paketus ({{count}})"},
    "el": {"packs.phrasePack.openDrawer": "Περιήγηση πακέτων φράσεων ({{count}})"},
    "hu": {"packs.phrasePack.openDrawer": "Kifejezéscsomagok böngészése ({{count}})"},
    "tr": {"packs.phrasePack.openDrawer": "Cümle paketlerine göz at ({{count}})"},
    "ar": {"packs.phrasePack.openDrawer": "تصفح حزم العبارات ({{count}})"},
    "he": {"packs.phrasePack.openDrawer": "עיון בחבילות ביטויים ({{count}})"},
    "fa": {"packs.phrasePack.openDrawer": "مرور بسته‌های عبارات ({{count}})"},
    "hi": {"packs.phrasePack.openDrawer": "फ्रेज़ पैक ब्राउज़ करें ({{count}})"},
    "mr": {"packs.phrasePack.openDrawer": "फ्रेज पॅक ब्राउझ करा ({{count}})"},
    "ne": {"packs.phrasePack.openDrawer": "फ्रेज प्याक हेर्नुहोस् ({{count}})"},
    "bn": {"packs.phrasePack.openDrawer": "ফ্রেজ প্যাক ব্রাউজ করুন ({{count}})"},
    "gu": {"packs.phrasePack.openDrawer": "ફ્રેઝ પેક બ્રાઉઝ કરો ({{count}})"},
    "kn": {"packs.phrasePack.openDrawer": "ಫ್ರೇಸ್ ಪ್ಯಾಕ್‌ಗಳನ್ನು ಬ್ರೌಸ್ ಮಾಡಿ ({{count}})"},
    "ta": {"packs.phrasePack.openDrawer": "சொற்றொடர் தொகுப்புகளைப் பார்க்க ({{count}})"},
    "te": {"packs.phrasePack.openDrawer": "ఫ్రేజ్ ప్యాక్‌లను బ్రౌజ్ చేయి ({{count}})"},
    "ur": {"packs.phrasePack.openDrawer": "فریز پیک براؤز کریں ({{count}})"},
    "pa-Arab": {"packs.phrasePack.openDrawer": "فریز پیک ویکھو ({{count}})"},
    "pa-Guru": {"packs.phrasePack.openDrawer": "ਫ੍ਰੇਜ਼ ਪੈਕ ਵੇਖੋ ({{count}})"},
    "zh-Hans": {"packs.phrasePack.openDrawer": "浏览短语包 ({{count}})"},
    "zh-Hant": {"packs.phrasePack.openDrawer": "瀏覽片語包 ({{count}})"},
    "yue-Hant-HK": {"packs.phrasePack.openDrawer": "瀏覽片語包 ({{count}})"},
    "ja": {"packs.phrasePack.openDrawer": "フレーズパックを見る ({{count}})"},
    "ko-polite": {"packs.phrasePack.openDrawer": "구문 팩 둘러보기 ({{count}})"},
    "vi": {"packs.phrasePack.openDrawer": "Duyệt gói cụm từ ({{count}})"},
    "th": {"packs.phrasePack.openDrawer": "เรียกดูชุดวลี ({{count}})"},
    "id": {"packs.phrasePack.openDrawer": "Jelajahi paket frasa ({{count}})"},
    "ms": {"packs.phrasePack.openDrawer": "Lihat pek frasa ({{count}})"},
    "sw": {"packs.phrasePack.openDrawer": "Vinjari pakiti za misemo ({{count}})"},
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
