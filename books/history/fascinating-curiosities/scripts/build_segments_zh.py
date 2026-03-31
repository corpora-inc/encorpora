#!/usr/bin/env python3
"""
Build segments_zh.json from segments.json + translation JSONL files.

Reads the English segments.json and applies Simplified Mandarin Chinese
translations from JSONL files to produce segments_zh.json.

Translation JSONL format (one JSON object per line):
    {"id": "ch00-001", "text": "致读者"}
    {"id": "ch01-067", "text": "...", "text_markdown": "..."}  # markdown override

Usage:
    cd books/fascinating-curiosities/scripts
    python build_segments_zh.py
"""

import json
import os
import sys

SEGMENTS_PATH = "../01-mystery-of-monte-alban/pack/segments.json"
OUTPUT_PATH = "../01-mystery-of-monte-alban/pack/segments_zh.json"

TRANSLATION_FILES = [
    "/tmp/translations_zh_batch1_fixed.jsonl",
    "/tmp/translations_zh_batch2_fixed.jsonl",
    "/tmp/translations_zh_batch3_fixed.jsonl",
    "/tmp/translations_zh_batch4_fixed.jsonl",
]

TITLE_MAP = {
    "A Note to the Reader": "致读者",
    "Part One: The Sacred Mountain": "第一部分：圣山",
    "Chapter 1 — The View from Above": "第一章 —— 俯瞰之景",
    "Chapter 2 — Before the Mountain": "第二章 —— 山之前",
    "Chapter 3 — The Founding": "第三章 —— 建城",
    "Chapter 4 — What Kind of Place Was This?": "第四章 —— 这是一个怎样的地方？",
    "Chapter 5 — The Danzantes": "第五章 —— \u201c舞者\u201d",
    "Chapter 6 — Building J and the Conquest Slabs": "第六章 —— J号建筑与征服石板",
    "Chapter 7 — What the Script Actually Is (And Isn't)": "第七章 —— 文字到底是什么（以及不是什么）",
    "Chapter 8 — How Writing Dies": "第八章 —— 文字如何消亡",
    "Chapter 9 — The Decipherment Race": "第九章 —— 破译竞赛",
    "Chapter 10 — The Decline": "第十章 —— 衰落",
    "Chapter 11 — The Walk Away": "第十一章 —— 离去",
    "Chapter 12 — The Afterlife of a City": "第十二章 —— 一座城市的来世",
    "Chapter 13 — Mitla: The Place of the Dead": "第十三章 —— 米特拉：死亡之地",
    "Chapter 14 — The Ball Game": "第十四章 —— 球赛",
    "Chapter 15 — What Was Happening Elsewhere": "第十五章 —— 其他地方发生了什么",
    "Part Two: The Lost Script": "第二部分：失落的文字",
    "Part Three: The Vanishing": "第三部分：消逝",
    "Part Four: Echoes and Neighbors": "第四部分：回响与邻邦",
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
    # Load English segments
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

        # Build Chinese segment
        zh_seg = {}

        # Copy structural fields unchanged
        for key in [
            "id", "part", "chapter", "paragraph_id", "sentence_index",
            "block_type", "heading_level", "image", "list_type", "list_index",
        ]:
            if key in seg:
                zh_seg[key] = seg[key]

        # Translate title
        orig_title = seg.get("title", "")
        zh_seg["title"] = TITLE_MAP.get(orig_title, orig_title)

        # Translate text
        zh_text = tr.get("text", seg.get("text", ""))
        zh_seg["text"] = zh_text

        # Translate text_markdown
        if "text_markdown" in tr:
            zh_seg["text_markdown"] = tr["text_markdown"]
        elif seg["block_type"] == "image" and "image" in seg:
            # For images, reconstruct markdown with translated alt text
            zh_seg["text_markdown"] = f"![{zh_text}]({seg['image']})"
        else:
            # Default: text_markdown = text (true for most segments)
            zh_seg["text_markdown"] = zh_text

        # Handle image_alt
        if "image_alt" in seg:
            zh_seg["image_alt"] = zh_text

        # Handle TTS
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

    # Build output
    output = {
        "version": "2.0.0",
        "book_id": "book_monte_alban",
        "language": "zh",
        "total_segments": len(chinese_segments),
        "segments": chinese_segments,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Written {len(chinese_segments)} segments to {OUTPUT_PATH}")

    # Verification
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
