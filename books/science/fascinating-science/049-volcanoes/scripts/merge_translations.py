#!/usr/bin/env python3
"""
Merge a compact translation dict with the English segments.json to produce segments_{lang}.json.

Translation dict format:
{
  "ch01-001": {"title": "Translated Title", "text": "Translated text."},
  "ch03-088": {"text": "Display text", "tts_text": "Phonetic TTS text"},
  ...
}

Usage:
    python3 merge_translations.py <pack_dir> <lang_code> <translations.json>
"""

import argparse
import json
from pathlib import Path

STRUCTURAL_FIELDS = {
    "id", "part", "chapter", "paragraph_id", "sentence_index",
    "block_type", "heading_level", "image", "list_type", "list_index",
}


def merge(pack_dir: Path, lang_code: str, translations_path: Path) -> Path:
    with open(pack_dir / "segments.json") as f:
        english = json.load(f)

    with open(translations_path) as f:
        translations = json.load(f)

    segments = []
    missing = []

    for seg in english["segments"]:
        seg_id = seg["id"]
        tr = translations.get(seg_id, {})
        new_seg = {}

        for field in STRUCTURAL_FIELDS:
            if field in seg:
                new_seg[field] = seg[field]

        translated_text = tr.get("text", seg.get("text", ""))
        new_seg["text"] = translated_text
        new_seg["text_markdown"] = tr.get("text_markdown", translated_text)

        if "title" in seg:
            new_seg["title"] = tr.get("title", seg["title"])

        if "tts" in seg:
            tts_text = tr.get("tts_text", translated_text)
            tts_entry = {"text": tts_text, "pause_after_ms": seg["tts"]["pause_after_ms"]}
            if "repetition_penalty" in seg["tts"]:
                tts_entry["repetition_penalty"] = seg["tts"]["repetition_penalty"]
            new_seg["tts"] = tts_entry

        segments.append(new_seg)

        if seg_id not in translations and seg.get("text"):
            missing.append(seg_id)

    output = {
        "version": english["version"],
        "book_id": english["book_id"],
        "language": lang_code,
        "total_segments": len(segments),
        "segments": segments,
    }

    output_path = pack_dir / f"segments_{lang_code}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Wrote {output_path} ({len(segments)} segments)")
    if missing:
        print(f"WARNING: {len(missing)} segments had no translation (kept English): {missing[:10]}")

    return output_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pack_dir", type=Path)
    parser.add_argument("lang_code")
    parser.add_argument("translations", type=Path)
    args = parser.parse_args()
    merge(args.pack_dir, args.lang_code, args.translations)


if __name__ == "__main__":
    main()
