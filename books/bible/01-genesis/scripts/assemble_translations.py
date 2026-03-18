#!/usr/bin/env python3
"""Assemble a translated segments file from Hebrew source + translations dict."""

import json
import sys
from pathlib import Path

PACK_DIR = Path("/home/skyl/encorpora/books/bible/01-genesis/pack")
SOURCE = PACK_DIR / "segments.json"


def assemble(lang: str, trans_path: str | None = None):
    if trans_path is None:
        trans_path = f"/tmp/genesis_trans_{lang}.json"

    with open(SOURCE, "r") as f:
        source = json.load(f)

    with open(trans_path, "r") as f:
        translations = json.load(f)

    # Build chapter heading lookup: chapter_num -> translated heading text
    chapter_headings = {}
    for seg in source["segments"]:
        if seg["block_type"] == "heading":
            sid = seg["id"]
            if sid in translations:
                chapter_headings[seg["chapter"]] = translations[sid]

    segments = []
    for seg in source["segments"]:
        sid = seg["id"]
        translated_text = translations.get(sid)
        if translated_text is None:
            print(f"WARNING: missing translation for {sid}", file=sys.stderr)
            continue

        new_seg = {
            "id": sid,
            "part": seg["part"],
            "chapter": seg["chapter"],
            "title": chapter_headings.get(seg["chapter"], seg["title"]),
            "paragraph_id": seg["paragraph_id"],
            "sentence_index": seg["sentence_index"],
            "block_type": seg["block_type"],
            "text": translated_text,
            "text_markdown": translated_text,
            "tts": {
                "text": translated_text,
                "pause_after_ms": seg["tts"]["pause_after_ms"],
            },
        }

        if seg["block_type"] == "heading":
            new_seg["heading_level"] = 2
            new_seg["text_markdown"] = f"## {translated_text}"

        segments.append(new_seg)

    output = {
        "version": "2.0.0",
        "book_id": "genesis",
        "language": lang,
        "total_segments": len(segments),
        "segments": segments,
    }

    out_path = PACK_DIR / f"segments_{lang}.json"
    with open(out_path, "w") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(segments)} segments to {out_path}")
    return len(segments)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <lang> [trans_path]")
        sys.exit(1)
    lang = sys.argv[1]
    tp = sys.argv[2] if len(sys.argv) > 2 else None
    count = assemble(lang, tp)
    if count != 1583:
        print(f"ERROR: expected 1583 segments, got {count}", file=sys.stderr)
        sys.exit(1)
