#!/usr/bin/env python3
"""
Build segments_es.json from segments.json + translation JSONL files.

Reads the English segments.json and applies translations from JSONL files
to produce the Spanish segments_es.json.

Translation JSONL format (one JSON object per line):
    {"id": "ch00-001", "text": "Nota para el lector"}
    {"id": "ch01-067", "text": "...", "text_markdown": "..."}  # markdown override

Usage:
    cd books/fascinating-curiosities/scripts
    python build_segments_es.py
"""

import json
import os
import sys

SEGMENTS_PATH = "../01-mystery-of-monte-alban/pack/segments.json"
OUTPUT_PATH = "../01-mystery-of-monte-alban/pack/segments_es.json"

TRANSLATION_FILES = [
    "/tmp/translations_batch1.jsonl",
    "/tmp/translations_batch2.jsonl",
    "/tmp/translations_batch3.jsonl",
    "/tmp/translations_batch4.jsonl",
]

TITLE_MAP = {
    "A Note to the Reader": "Nota para el lector",
    "Part One: The Sacred Mountain": "Primera parte: La montaña sagrada",
    "Chapter 1 \u2014 The View from Above": "Cap\u00edtulo 1 \u2014 La vista desde arriba",
    "Chapter 2 \u2014 Before the Mountain": "Cap\u00edtulo 2 \u2014 Antes de la montaña",
    "Chapter 3 \u2014 The Founding": "Cap\u00edtulo 3 \u2014 La fundaci\u00f3n",
    "Chapter 4 \u2014 What Kind of Place Was This?": "Cap\u00edtulo 4 \u2014 \u00bfQu\u00e9 tipo de lugar era este?",
    "Chapter 5 \u2014 The Danzantes": "Cap\u00edtulo 5 \u2014 Los Danzantes",
    "Chapter 6 \u2014 Building J and the Conquest Slabs": "Cap\u00edtulo 6 \u2014 El Edificio J y las losas de conquista",
    "Chapter 7 \u2014 What the Script Actually Is (And Isn't)": "Cap\u00edtulo 7 \u2014 Lo que la escritura realmente es (y no es)",
    "Chapter 8 \u2014 How Writing Dies": "Cap\u00edtulo 8 \u2014 C\u00f3mo muere una escritura",
    "Chapter 9 \u2014 The Decipherment Race": "Cap\u00edtulo 9 \u2014 La carrera por el desciframiento",
    "Chapter 10 \u2014 The Decline": "Cap\u00edtulo 10 \u2014 El declive",
    "Chapter 11 \u2014 The Walk Away": "Cap\u00edtulo 11 \u2014 El abandono",
    "Chapter 12 \u2014 The Afterlife of a City": "Cap\u00edtulo 12 \u2014 La vida despu\u00e9s de una ciudad",
    "Chapter 13 \u2014 Mitla: The Place of the Dead": "Cap\u00edtulo 13 \u2014 Mitla: El lugar de los muertos",
    "Chapter 14 \u2014 The Ball Game": "Cap\u00edtulo 14 \u2014 El juego de pelota",
    "Chapter 15 \u2014 What Was Happening Elsewhere": "Cap\u00edtulo 15 \u2014 Lo que suced\u00eda en el resto del mundo",
    "Part Two: The Lost Script": "Segunda parte: La escritura perdida",
    "Part Three: The Vanishing": "Tercera parte: La desaparici\u00f3n",
    "Part Four: Echoes and Neighbors": "Cuarta parte: Ecos y vecinos",
    "What We Still Don't Know": "Lo que a\u00fan no sabemos",
    "Key Names and Terms": "Nombres y t\u00e9rminos clave",
    "Further Reading": "Lecturas recomendadas",
    "About This Series": "Acerca de esta serie",
    "Image Credits": "Cr\u00e9ditos de im\u00e1genes",
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


def build_spanish_segments():
    # Load English segments
    with open(SEGMENTS_PATH, "r") as f:
        data = json.load(f)

    translations = load_translations()
    print(f"Loaded {len(translations)} translations")

    missing = []
    spanish_segments = []

    for seg in data["segments"]:
        sid = seg["id"]
        tr = translations.get(sid, {})

        if not tr:
            missing.append(sid)

        # Build Spanish segment
        es_seg = {}

        # Copy structural fields unchanged
        for key in [
            "id", "part", "chapter", "paragraph_id", "sentence_index",
            "block_type", "heading_level", "image", "list_type", "list_index",
        ]:
            if key in seg:
                es_seg[key] = seg[key]

        # Translate title
        orig_title = seg.get("title", "")
        es_seg["title"] = TITLE_MAP.get(orig_title, orig_title)

        # Translate text
        es_text = tr.get("text", seg.get("text", ""))
        es_seg["text"] = es_text

        # Translate text_markdown
        if "text_markdown" in tr:
            es_seg["text_markdown"] = tr["text_markdown"]
        elif seg["block_type"] == "image" and "image" in seg:
            # For images, reconstruct markdown with translated alt text
            es_seg["text_markdown"] = f"![{es_text}]({seg['image']})"
        else:
            # Default: text_markdown = text (true for most segments)
            es_seg["text_markdown"] = es_text

        # Handle image_alt
        if "image_alt" in seg:
            es_seg["image_alt"] = es_text

        # Handle TTS
        if "tts" in seg:
            es_seg["tts"] = {
                "text": es_text,
                "pause_after_ms": seg["tts"]["pause_after_ms"],
            }

        spanish_segments.append(es_seg)

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
        "language": "es",
        "total_segments": len(spanish_segments),
        "segments": spanish_segments,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Written {len(spanish_segments)} segments to {OUTPUT_PATH}")

    # Verification
    tts_count = sum(1 for s in spanish_segments if s.get("tts", {}).get("text", ""))
    long_tts = [
        s for s in spanish_segments
        if len(s.get("tts", {}).get("text", "")) > 400
    ]
    print(f"TTS segments: {tts_count}")
    if long_tts:
        print(f"WARNING: {len(long_tts)} TTS texts exceed 400 chars:")
        for s in long_tts[:5]:
            print(f"  {s['id']}: {len(s['tts']['text'])} chars")


if __name__ == "__main__":
    build_spanish_segments()
