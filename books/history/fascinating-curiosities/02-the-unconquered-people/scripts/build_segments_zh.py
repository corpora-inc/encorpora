#!/usr/bin/env python3
"""
Build segments_zh.json from segments.json + Chinese translation JSONL files.

Reads the English segments.json and applies Simplified Mandarin Chinese
translations from JSONL files to produce segments_zh.json.

Translation JSONL format (one JSON object per line):
    {"id": "ch00-001", "text": "致读者"}
    {"id": "ch01-067", "text": "...", "text_markdown": "..."}

Usage:
    python3 build_segments_zh.py
"""

import json
import os

SEGMENTS_PATH = "/home/skyl/encorpora/books/fascinating-curiosities/02-the-unconquered-people/pack/segments.json"
OUTPUT_PATH = "/home/skyl/encorpora/books/fascinating-curiosities/02-the-unconquered-people/pack/segments_zh.json"

TRANSLATION_FILES = [
    "/tmp/translations_zh_book02_batch1.jsonl",
    "/tmp/translations_zh_book02_batch2.jsonl",
    "/tmp/translations_zh_book02_batch3.jsonl",
    "/tmp/translations_zh_book02_batch4.jsonl",
]

TITLE_MAP = {
    "A Note to the Reader": "致读者",
    "Part One: The Unconquered Nation": "第一部分：不屈的民族",
    "Chapter 1 — The Land Between Two Empires": "第一章 —— 两大帝国之间的土地",
    "Chapter 2 — Before the Word \"Mapuche\"": "第二章 —— 在\u201c马普切\u201d一词出现之前",
    "Chapter 3 — The Spaniards Arrive": "第三章 —— 西班牙人的到来",
    "Chapter 4 — Lautaro and the Turning": "第四章 —— 劳塔罗与转折",
    "Part Two: The Unwritten Tongue": "第二部分：未被书写的语言",
    "Chapter 5 — A Language Without a State": "第五章 —— 一种没有国家的语言",
    "Chapter 6 — How Mapudungun Works": "第六章 —— 马普敦贡语的运作方式",
    "Chapter 7 — What the Language Encodes": "第七章 —— 语言所编码的信息",
    "Chapter 8 — Why It Survived": "第八章 —— 它为何幸存",
    "Chapter 9 — Mapudungun Today": "第九章 —— 今日的马普敦贡语",
    "Part Three: The Invisible State": "第三部分：隐形的国家",
    "Chapter 10 — How to Win a War Without an Army": "第十章 —— 如何在没有军队的情况下赢得战争",
    "Chapter 11 — The Parliament System": "第十一章 —— 议会制度",
    "Chapter 12 — A Nation Without a Capital": "第十二章 —— 一个没有首都的国家",
    "Chapter 13 — The Fall": "第十三章 —— 陨落",
    "Part Four: Echoes of Wallmapu": "第四部分：瓦尔马普的回响",
    "Chapter 14 — The Mapuche Today": "第十四章 —— 今日的马普切人",
    "Chapter 15 — What Was Happening Elsewhere": "第十五章 —— 其他地方发生了什么",
    "What We Still Don't Know": "我们仍不知道什么",
    "Key Names and Terms": "重要名称和术语",
    "Further Reading": "延伸阅读",
    "About This Series": "关于本系列",
    "Image Credits": "图片鸣谢",
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


def build_chinese_segments():
    with open(SEGMENTS_PATH, "r") as f:
        data = json.load(f)

    translations = load_translations()
    print(f"Loaded {len(translations)} translations")

    missing = []
    chinese_segments = []

    for seg in data["segments"]:
        sid = seg["id"]
        tr = translations.get(sid, {})

        if not tr:
            missing.append(sid)

        zh_seg = {}

        for key in [
            "id", "part", "chapter", "paragraph_id", "sentence_index",
            "block_type", "heading_level", "image", "list_type", "list_index",
        ]:
            if key in seg:
                zh_seg[key] = seg[key]

        orig_title = seg.get("title", "")
        zh_seg["title"] = TITLE_MAP.get(orig_title, orig_title)

        zh_text = tr.get("text", seg.get("text", ""))
        zh_seg["text"] = zh_text

        if "text_markdown" in tr:
            zh_seg["text_markdown"] = tr["text_markdown"]
        elif seg["block_type"] == "image" and "image" in seg:
            zh_seg["text_markdown"] = f"![{zh_text}]({seg['image']})"
        else:
            zh_seg["text_markdown"] = zh_text

        if "image_alt" in seg:
            zh_seg["image_alt"] = zh_text

        if "tts" in seg:
            zh_seg["tts"] = {
                "text": zh_text,
                "pause_after_ms": seg["tts"]["pause_after_ms"],
            }

        chinese_segments.append(zh_seg)

    if missing:
        print(f"WARNING: {len(missing)} segments missing translations:")
        for sid in missing[:20]:
            print(f"  {sid}")
        if len(missing) > 20:
            print(f"  ... and {len(missing) - 20} more")

    output = {
        "version": "2.0.0",
        "book_id": "book_the_unconquered_people",
        "language": "zh",
        "total_segments": len(chinese_segments),
        "segments": chinese_segments,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Written {len(chinese_segments)} segments to {OUTPUT_PATH}")

    tts_count = sum(1 for s in chinese_segments if s.get("tts", {}).get("text", ""))
    long_tts = [
        s for s in chinese_segments
        if len(s.get("tts", {}).get("text", "")) > 400
    ]
    print(f"TTS segments: {tts_count}")
    if long_tts:
        print(f"WARNING: {len(long_tts)} TTS texts exceed 400 chars:")
        for s in long_tts[:5]:
            print(f"  {s['id']}: {len(s['tts']['text'])} chars")


if __name__ == "__main__":
    build_chinese_segments()
