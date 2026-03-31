#!/usr/bin/env python3
"""
Build segments_ar.json from segments.json + Arabic translation JSONL files.

Reads the English segments.json and applies Modern Standard Arabic (MSA)
translations from JSONL files to produce segments_ar.json.

Key difference from ES/FR/ZH: Arabic JSONL has a separate tts_text field
containing fully diacritized (tashkeel) text for TTS pronunciation accuracy.

Translation JSONL format (one JSON object per line):
    {"id": "ch00-001", "text": "ملاحظة للقارئ", "tts_text": "مُلَاحَظَةٌ لِلْقَارِئِ"}
    {"id": "ch01-067", "text": "...", "tts_text": "...", "text_markdown": "..."}

Usage:
    python3 build_segments_ar.py
"""

import json
import os
import unicodedata

SEGMENTS_PATH = "/home/skyl/encorpora/books/fascinating-curiosities/02-the-unconquered-people/pack/segments.json"
OUTPUT_PATH = "/home/skyl/encorpora/books/fascinating-curiosities/02-the-unconquered-people/pack/segments_ar.json"

TRANSLATION_FILES = [
    "/tmp/translations_ar_book02_batch1.jsonl",
    "/tmp/translations_ar_book02_batch2.jsonl",
    "/tmp/translations_ar_book02_batch3.jsonl",
    "/tmp/translations_ar_book02_batch4.jsonl",
]

TITLE_MAP = {
    "A Note to the Reader": "ملاحظة للقارئ",
    "Part One: The Unconquered Nation": "الجزء الأول: الأمة التي لم تُقهر",
    "Chapter 1 — The Land Between Two Empires": "الفصل الأول — الأرض بين إمبراطوريتين",
    "Chapter 2 — Before the Word \"Mapuche\"": "الفصل الثاني — قبل كلمة «مابوتشي»",
    "Chapter 3 — The Spaniards Arrive": "الفصل الثالث — وصول الإسبان",
    "Chapter 4 — Lautaro and the Turning": "الفصل الرابع — لاوتارو ونقطة التحول",
    "Part Two: The Unwritten Tongue": "الجزء الثاني: اللسان غير المكتوب",
    "Chapter 5 — A Language Without a State": "الفصل الخامس — لغة بلا دولة",
    "Chapter 6 — How Mapudungun Works": "الفصل السادس — كيف تعمل لغة المابودونغون",
    "Chapter 7 — What the Language Encodes": "الفصل السابع — ما تُشفّره اللغة",
    "Chapter 8 — Why It Survived": "الفصل الثامن — لماذا نجت",
    "Chapter 9 — Mapudungun Today": "الفصل التاسع — المابودونغون اليوم",
    "Part Three: The Invisible State": "الجزء الثالث: الدولة الخفية",
    "Chapter 10 — How to Win a War Without an Army": "الفصل العاشر — كيف تربح حرباً بلا جيش",
    "Chapter 11 — The Parliament System": "الفصل الحادي عشر — النظام البرلماني",
    "Chapter 12 — A Nation Without a Capital": "الفصل الثاني عشر — أمة بلا عاصمة",
    "Chapter 13 — The Fall": "الفصل الثالث عشر — السقوط",
    "Part Four: Echoes of Wallmapu": "الجزء الرابع: أصداء وال‌مابو",
    "Chapter 14 — The Mapuche Today": "الفصل الرابع عشر — المابوتشي اليوم",
    "Chapter 15 — What Was Happening Elsewhere": "الفصل الخامس عشر — ما الذي كان يحدث في أماكن أخرى",
    "What We Still Don't Know": "ما لا نزال نجهله",
    "Key Names and Terms": "الأسماء والمصطلحات الرئيسية",
    "Further Reading": "قراءات إضافية",
    "About This Series": "حول هذه السلسلة",
    "Image Credits": "مصادر الصور",
}


def load_translations():
    """Load all translation JSONL files into a dict keyed by segment ID."""
    translations = {}
    for path in TRANSLATION_FILES:
        if not os.path.exists(path):
            print(f"WARNING: Translation file not found: {path}")
            continue
        with open(path, "r") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError as e:
                    print(f"WARNING: Bad JSON on line {line_num} of {path}: {e}")
                    continue
                translations[entry["id"]] = entry
    return translations


def build_arabic_segments():
    with open(SEGMENTS_PATH, "r") as f:
        data = json.load(f)

    translations = load_translations()
    print(f"Loaded {len(translations)} translations")

    missing = []
    arabic_segments = []

    for seg in data["segments"]:
        sid = seg["id"]
        tr = translations.get(sid, {})

        if not tr:
            missing.append(sid)

        ar_seg = {}

        for key in [
            "id", "part", "chapter", "paragraph_id", "sentence_index",
            "block_type", "heading_level", "image", "list_type", "list_index",
        ]:
            if key in seg:
                ar_seg[key] = seg[key]

        orig_title = seg.get("title", "")
        ar_seg["title"] = TITLE_MAP.get(orig_title, orig_title)

        ar_text = tr.get("text", seg.get("text", ""))
        ar_seg["text"] = ar_text

        if "text_markdown" in tr:
            ar_seg["text_markdown"] = tr["text_markdown"]
        elif seg["block_type"] == "image" and "image" in seg:
            ar_seg["text_markdown"] = f"![{ar_text}]({seg['image']})"
        else:
            ar_seg["text_markdown"] = ar_text

        if "image_alt" in seg:
            ar_seg["image_alt"] = ar_text

        # Handle TTS — use separate tts_text field (diacritized) for Arabic
        if "tts" in seg:
            tts_text = tr.get("tts_text", ar_text)
            ar_seg["tts"] = {
                "text": tts_text,
                "pause_after_ms": seg["tts"]["pause_after_ms"],
            }

        arabic_segments.append(ar_seg)

    if missing:
        print(f"WARNING: {len(missing)} segments missing translations:")
        for sid in missing[:20]:
            print(f"  {sid}")
        if len(missing) > 20:
            print(f"  ... and {len(missing) - 20} more")

    output = {
        "version": "2.0.0",
        "book_id": "book_the_unconquered_people",
        "language": "ar",
        "total_segments": len(arabic_segments),
        "segments": arabic_segments,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Written {len(arabic_segments)} segments to {OUTPUT_PATH}")

    # Verification
    tts_count = sum(1 for s in arabic_segments if s.get("tts", {}).get("text", ""))
    long_tts = [
        s for s in arabic_segments
        if len(s.get("tts", {}).get("text", "")) > 400
    ]

    # Check for tashkeel marks in tts.text
    tashkeel_count = 0
    no_tashkeel = []
    for s in arabic_segments:
        tts_text = s.get("tts", {}).get("text", "")
        if tts_text:
            has_tashkeel = any(
                unicodedata.category(c) == "Mn" and ord(c) in range(0x0610, 0x065F + 1)
                for c in tts_text
            )
            if has_tashkeel:
                tashkeel_count += 1
            else:
                no_tashkeel.append(s["id"])

    print(f"TTS segments: {tts_count}")
    print(f"TTS with tashkeel: {tashkeel_count}/{tts_count}")
    if no_tashkeel:
        print(f"WARNING: {len(no_tashkeel)} TTS texts missing tashkeel:")
        for sid in no_tashkeel[:10]:
            print(f"  {sid}")

    if long_tts:
        print(f"WARNING: {len(long_tts)} TTS texts exceed 400 chars:")
        for s in long_tts[:5]:
            print(f"  {s['id']}: {len(s['tts']['text'])} chars")


if __name__ == "__main__":
    build_arabic_segments()
