#!/usr/bin/env python3
"""
Build segments_fr.json from segments.json + translation JSONL files.

Reads the English segments.json and applies translations from JSONL files
to produce the French segments_fr.json.

Translation JSONL format (one JSON object per line):
    {"id": "ch00-001", "text": "Note au lecteur"}
    {"id": "ch01-067", "text": "...", "text_markdown": "..."}  # markdown override

Usage:
    python build_segments_fr.py
"""

import json
import os

SEGMENTS_PATH = "/home/skyl/encorpora/books/fascinating-curiosities/01-mystery-of-monte-alban/pack/segments.json"
OUTPUT_PATH = "/home/skyl/encorpora/books/fascinating-curiosities/01-mystery-of-monte-alban/pack/segments_fr.json"

TRANSLATION_FILES = [
    "/tmp/translations_fr_batch1.jsonl",
    "/tmp/translations_fr_batch2.jsonl",
    "/tmp/translations_fr_batch3.jsonl",
    "/tmp/translations_fr_batch4.jsonl",
]

TITLE_MAP = {
    "A Note to the Reader": "Note au lecteur",
    "Part One: The Sacred Mountain": "Première partie : La montagne sacrée",
    "Chapter 1 — The View from Above": "Chapitre 1 — La vue d'en haut",
    "Chapter 2 — Before the Mountain": "Chapitre 2 — Avant la montagne",
    "Chapter 3 — The Founding": "Chapitre 3 — La fondation",
    "Chapter 4 — What Kind of Place Was This?": "Chapitre 4 — Quel genre d'endroit était-ce ?",
    "Chapter 5 — The Danzantes": "Chapitre 5 — Les Danzantes",
    "Chapter 6 — Building J and the Conquest Slabs": "Chapitre 6 — L'Édifice J et les dalles de conquête",
    "Chapter 7 — What the Script Actually Is (And Isn't)": "Chapitre 7 — Ce qu'est vraiment l'écriture (et ce qu'elle n'est pas)",
    "Chapter 8 — How Writing Dies": "Chapitre 8 — Comment meurt une écriture",
    "Chapter 9 — The Decipherment Race": "Chapitre 9 — La course au déchiffrement",
    "Chapter 10 — The Decline": "Chapitre 10 — Le déclin",
    "Chapter 11 — The Walk Away": "Chapitre 11 — L'abandon",
    "Chapter 12 — The Afterlife of a City": "Chapitre 12 — La vie après la mort d'une cité",
    "Chapter 13 — Mitla: The Place of the Dead": "Chapitre 13 — Mitla : Le lieu des morts",
    "Chapter 14 — The Ball Game": "Chapitre 14 — Le jeu de balle",
    "Chapter 15 — What Was Happening Elsewhere": "Chapitre 15 — Ce qui se passait ailleurs",
    "Part Two: The Lost Script": "Deuxième partie : L'écriture perdue",
    "Part Three: The Vanishing": "Troisième partie : La disparition",
    "Part Four: Echoes and Neighbors": "Quatrième partie : Échos et voisins",
    "What We Still Don't Know": "Ce que nous ne savons toujours pas",
    "Key Names and Terms": "Noms et termes clés",
    "Further Reading": "Pour aller plus loin",
    "About This Series": "À propos de cette série",
    "Image Credits": "Crédits des images",
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


def build_french_segments():
    with open(SEGMENTS_PATH, "r") as f:
        data = json.load(f)

    translations = load_translations()
    print(f"Loaded {len(translations)} translations")

    missing = []
    french_segments = []

    for seg in data["segments"]:
        sid = seg["id"]
        tr = translations.get(sid, {})

        if not tr:
            missing.append(sid)

        fr_seg = {}

        for key in [
            "id", "part", "chapter", "paragraph_id", "sentence_index",
            "block_type", "heading_level", "image", "list_type", "list_index",
        ]:
            if key in seg:
                fr_seg[key] = seg[key]

        orig_title = seg.get("title", "")
        fr_seg["title"] = TITLE_MAP.get(orig_title, orig_title)

        fr_text = tr.get("text", seg.get("text", ""))
        fr_seg["text"] = fr_text

        if "text_markdown" in tr:
            fr_seg["text_markdown"] = tr["text_markdown"]
        elif seg["block_type"] == "image" and "image" in seg:
            fr_seg["text_markdown"] = f"![{fr_text}]({seg['image']})"
        else:
            fr_seg["text_markdown"] = fr_text

        if "image_alt" in seg:
            fr_seg["image_alt"] = fr_text

        if "tts" in seg:
            fr_seg["tts"] = {
                "text": fr_text,
                "pause_after_ms": seg["tts"]["pause_after_ms"],
            }

        french_segments.append(fr_seg)

    if missing:
        print(f"WARNING: {len(missing)} segments missing translations:")
        for sid in missing[:20]:
            print(f"  {sid}")
        if len(missing) > 20:
            print(f"  ... and {len(missing) - 20} more")

    output = {
        "version": "2.0.0",
        "book_id": "book_monte_alban",
        "language": "fr",
        "total_segments": len(french_segments),
        "segments": french_segments,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Written {len(french_segments)} segments to {OUTPUT_PATH}")

    tts_count = sum(1 for s in french_segments if s.get("tts", {}).get("text", ""))
    long_tts = [
        s for s in french_segments
        if len(s.get("tts", {}).get("text", "")) > 400
    ]
    print(f"TTS segments: {tts_count}")
    if long_tts:
        print(f"WARNING: {len(long_tts)} TTS texts exceed 400 chars:")
        for s in long_tts[:5]:
            print(f"  {s['id']}: {len(s['tts']['text'])} chars")


if __name__ == "__main__":
    build_french_segments()
