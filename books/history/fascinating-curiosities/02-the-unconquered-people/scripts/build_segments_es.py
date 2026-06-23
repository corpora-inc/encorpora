#!/usr/bin/env python3
"""
Build segments_es.json from segments.json + Spanish translation JSONL files.

Reads the English segments.json and applies translations from JSONL files
to produce the Spanish segments_es.json.

Translation JSONL format (one JSON object per line):
    {"id": "ch00-001", "text": "Nota para el lector"}
    {"id": "ch01-067", "text": "...", "text_markdown": "..."}

Usage:
    python3 build_segments_es.py
"""

import json
import os

SEGMENTS_PATH = "/home/skyl/encorpora/books/fascinating-curiosities/02-the-unconquered-people/pack/segments.json"
OUTPUT_PATH = "/home/skyl/encorpora/books/fascinating-curiosities/02-the-unconquered-people/pack/segments_es.json"

TRANSLATION_FILES = [
    "/tmp/translations_es_book02_batch1.jsonl",
    "/tmp/translations_es_book02_batch2.jsonl",
    "/tmp/translations_es_book02_batch3.jsonl",
    "/tmp/translations_es_book02_batch4.jsonl",
]

TITLE_MAP = {
    "A Note to the Reader": "Nota para el lector",
    "Part One: The Unconquered Nation": "Primera parte: La nación invicta",
    "Chapter 1 — The Land Between Two Empires": "Capítulo 1 — La tierra entre dos imperios",
    "Chapter 2 — Before the Word \"Mapuche\"": "Capítulo 2 — Antes de la palabra «mapuche»",
    "Chapter 3 — The Spaniards Arrive": "Capítulo 3 — Llegan los españoles",
    "Chapter 4 — Lautaro and the Turning": "Capítulo 4 — Lautaro y el punto de inflexión",
    "Part Two: The Unwritten Tongue": "Segunda parte: La lengua no escrita",
    "Chapter 5 — A Language Without a State": "Capítulo 5 — Una lengua sin Estado",
    "Chapter 6 — How Mapudungun Works": "Capítulo 6 — Cómo funciona el mapudungun",
    "Chapter 7 — What the Language Encodes": "Capítulo 7 — Lo que codifica la lengua",
    "Chapter 8 — Why It Survived": "Capítulo 8 — Por qué sobrevivió",
    "Chapter 9 — Mapudungun Today": "Capítulo 9 — El mapudungun hoy",
    "Part Three: The Invisible State": "Tercera parte: El Estado invisible",
    "Chapter 10 — How to Win a War Without an Army": "Capítulo 10 — Cómo ganar una guerra sin ejército",
    "Chapter 11 — The Parliament System": "Capítulo 11 — El sistema parlamentario",
    "Chapter 12 — A Nation Without a Capital": "Capítulo 12 — Una nación sin capital",
    "Chapter 13 — The Fall": "Capítulo 13 — La caída",
    "Part Four: Echoes of Wallmapu": "Cuarta parte: Ecos de Wallmapu",
    "Chapter 14 — The Mapuche Today": "Capítulo 14 — Los mapuche hoy",
    "Chapter 15 — What Was Happening Elsewhere": "Capítulo 15 — Lo que sucedía en el resto del mundo",
    "What We Still Don't Know": "Lo que aún no sabemos",
    "Key Names and Terms": "Nombres y términos clave",
    "Further Reading": "Lecturas recomendadas",
    "About This Series": "Acerca de esta serie",
    "Image Credits": "Créditos de imágenes",
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

        es_seg = {}

        for key in [
            "id", "part", "chapter", "paragraph_id", "sentence_index",
            "block_type", "heading_level", "image", "list_type", "list_index",
        ]:
            if key in seg:
                es_seg[key] = seg[key]

        orig_title = seg.get("title", "")
        es_seg["title"] = TITLE_MAP.get(orig_title, orig_title)

        es_text = tr.get("text", seg.get("text", ""))
        es_seg["text"] = es_text

        if "text_markdown" in tr:
            es_seg["text_markdown"] = tr["text_markdown"]
        elif seg["block_type"] == "image" and "image" in seg:
            es_seg["text_markdown"] = f"![{es_text}]({seg['image']})"
        else:
            es_seg["text_markdown"] = es_text

        if "image_alt" in seg:
            es_seg["image_alt"] = es_text

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

    output = {
        "version": "2.0.0",
        "book_id": "book_the_unconquered_people",
        "language": "es",
        "total_segments": len(spanish_segments),
        "segments": spanish_segments,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Written {len(spanish_segments)} segments to {OUTPUT_PATH}")

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
