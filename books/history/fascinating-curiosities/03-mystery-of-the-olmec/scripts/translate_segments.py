#!/usr/bin/env python3
"""
Translate segments.json into segments_{lang}.json for 22 languages.

Uses the Anthropic API (Claude) to translate all TTS segments in batches,
then merges translations with structural metadata from the English source.

Usage:
    python3 translate_segments.py <pack_dir> [--langs es,fr,de,...]

Requires: anthropic (pip install anthropic)
"""

import argparse
import json
import sys
import time
from pathlib import Path

import anthropic

LANG_NAMES = {
    "ar": "Arabic",
    "da": "Danish",
    "de": "German",
    "el": "Greek",
    "es": "Spanish",
    "fi": "Finnish",
    "fr": "French",
    "he": "Hebrew",
    "hi": "Hindi",
    "it": "Italian",
    "ja": "Japanese",
    "ko": "Korean",
    "ms": "Malay",
    "nl": "Dutch",
    "no": "Norwegian",
    "pl": "Polish",
    "pt": "Brazilian Portuguese",
    "ru": "Russian",
    "sv": "Swedish",
    "sw": "Swahili",
    "tr": "Turkish",
    "zh": "Mandarin Chinese",
}

ALL_LANGS = list(LANG_NAMES.keys())

# Structural fields copied verbatim from English source.
STRUCTURAL_FIELDS = {
    "id", "part", "chapter", "paragraph_id", "sentence_index",
    "block_type", "heading_level", "image", "image_alt",
    "list_type", "list_index",
}

BATCH_SIZE = 40  # segments per API call (smaller = fewer JSON parse failures)


def load_segments(pack_dir: Path) -> dict:
    """Load English segments.json."""
    path = pack_dir / "segments.json"
    with open(path) as f:
        return json.load(f)


def build_translation_prompt(segments: list[dict], lang_code: str) -> str:
    """Build the translation prompt for a batch of segments."""
    lang_name = LANG_NAMES.get(lang_code, lang_code)

    items = []
    for seg in segments:
        item = {"id": seg["id"], "text": seg["text"]}
        if seg.get("text_markdown") and seg["text_markdown"] != seg["text"]:
            item["text_markdown"] = seg["text_markdown"]
        if seg.get("title"):
            item["title"] = seg["title"]
        if seg.get("image_alt"):
            item["image_alt"] = seg["image_alt"]
        items.append(item)

    return f"""Translate the following JSON array of text segments from English to {lang_name}.

RULES:
- Translate the "text", "text_markdown", "title", and "image_alt" fields
- Keep the "id" field unchanged
- If "text_markdown" is present, translate it preserving any markdown formatting
- If "title" is present, translate it
- If "image_alt" is present, translate it
- Return ONLY a valid JSON array with the translated objects, no other text
- CRITICAL: All string values must be valid JSON strings. Escape any double quotes inside strings with backslash. Use Unicode escapes if needed.
- This is a history and archaeology book about the ancient Olmec civilization of Mesoamerica, written for curious general readers
- Preserve the engaging, narrative tone — scholarly but accessible
- Keep proper nouns in their original form: Olmec, San Lorenzo, La Venta, Tres Zapotes, Cascajal, Tuxtla, Mesoamerica, etc.
- Keep archaeological terms that are commonly used untranslated in {lang_name} as-is
- Translate measurement units naturally for {lang_name} speakers
- Do NOT add or remove content
- For {lang_name}, use the most natural phrasing a native-speaking reader would expect

INPUT:
{json.dumps(items, ensure_ascii=False, indent=2)}

OUTPUT (valid JSON array only, all quotes properly escaped):"""


def repair_json(text: str) -> str:
    """Try to repair common JSON issues from LLM output."""
    import re

    # Try to find the JSON array boundaries
    start = text.find("[")
    end = text.rfind("]")
    if start >= 0 and end > start:
        text = text[start:end + 1]

    # Try as-is first
    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass

    # Fix trailing commas before ] or }
    text = re.sub(r',\s*([}\]])', r'\1', text)

    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass

    # Try truncating to last complete object if array is cut off
    last_brace = text.rfind("}")
    if last_brace > 0:
        candidate = text[:last_brace + 1] + "]"
        try:
            json.loads(candidate)
            return candidate
        except json.JSONDecodeError:
            pass

    # Last resort: extract individual JSON objects with regex and rebuild array
    objs = []
    for m in re.finditer(r'\{[^{}]*\}', text):
        try:
            obj = json.loads(m.group())
            if "id" in obj and "text" in obj:
                objs.append(obj)
        except json.JSONDecodeError:
            continue
    if objs:
        return json.dumps(objs, ensure_ascii=False)

    return text  # Return as-is, let caller handle the error


def translate_batch(
    client: anthropic.Anthropic,
    segments: list[dict],
    lang_code: str,
    *,
    max_retries: int = 5,
) -> list[dict]:
    """Translate a batch of segments via Claude API."""
    prompt = build_translation_prompt(segments, lang_code)

    for attempt in range(1, max_retries + 1):
        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=16384,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()

            # Strip markdown code fences if present
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
                if text.endswith("```"):
                    text = text[: text.rfind("```")]
                text = text.strip()

            # Try to repair malformed JSON
            text = repair_json(text)

            translations = json.loads(text)
            if not isinstance(translations, list):
                raise ValueError(f"Expected list, got {type(translations)}")
            return translations

        except (json.JSONDecodeError, ValueError, anthropic.APIError) as exc:
            print(
                f"  Attempt {attempt}/{max_retries} failed: {exc}",
                file=sys.stderr,
            )
            if attempt < max_retries:
                time.sleep(2 ** attempt)
            else:
                raise


def build_translated_segments(
    english_data: dict,
    translations: dict[str, dict],
    lang_code: str,
) -> dict:
    """Merge translations with English structural metadata."""
    segments = []
    for seg in english_data["segments"]:
        seg_id = seg["id"]
        tr = translations.get(seg_id, {})

        new_seg = {}
        # Copy structural fields
        for field in STRUCTURAL_FIELDS:
            if field in seg:
                new_seg[field] = seg[field]

        # Apply translations (fall back to English if missing)
        new_seg["text"] = tr.get("text", seg["text"])
        new_seg["text_markdown"] = tr.get(
            "text_markdown", tr.get("text", seg.get("text_markdown", seg["text"]))
        )

        # Title: use translation if available
        if "title" in seg:
            new_seg["title"] = tr.get("title", seg["title"])

        # Image alt: use translation if available
        if "image_alt" in seg:
            new_seg["image_alt"] = tr.get("image_alt", seg["image_alt"])

        # TTS field: only for segments that have it in English
        if "tts" in seg:
            new_seg["tts"] = {
                "text": tr.get("text", seg["tts"]["text"]),
                "pause_after_ms": seg["tts"]["pause_after_ms"],
            }
            if "repetition_penalty" in seg["tts"]:
                new_seg["tts"]["repetition_penalty"] = seg["tts"]["repetition_penalty"]

        segments.append(new_seg)

    return {
        "version": english_data["version"],
        "book_id": english_data["book_id"],
        "language": lang_code,
        "total_segments": len(segments),
        "segments": segments,
    }


def translate_language(
    client: anthropic.Anthropic,
    english_data: dict,
    lang_code: str,
    pack_dir: Path,
) -> Path:
    """Translate all segments for one language and write segments_{lang}.json."""
    lang_name = LANG_NAMES.get(lang_code, lang_code)
    output_path = pack_dir / f"segments_{lang_code}.json"

    # Skip if already exists
    if output_path.exists():
        print(f"\n  SKIP {lang_name} ({lang_code}): {output_path} already exists")
        return output_path

    # Only translate segments that have translatable text
    translatable = [
        seg for seg in english_data["segments"]
        if seg.get("text") and seg["block_type"] not in ("hr", "code_block")
    ]

    print(f"\n{'='*60}")
    print(f"Translating to {lang_name} ({lang_code}): {len(translatable)} segments")
    print(f"{'='*60}")

    # Translate in batches
    all_translations: dict[str, dict] = {}
    total_batches = (len(translatable) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(translatable), BATCH_SIZE):
        batch = translatable[i : i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        print(
            f"  Batch {batch_num}/{total_batches} "
            f"({len(batch)} segments: {batch[0]['id']}..{batch[-1]['id']})"
        )

        results = translate_batch(client, batch, lang_code)

        for tr in results:
            all_translations[tr["id"]] = tr

        print(f"    Got {len(results)} translations")

        # Rate limiting: brief pause between batches
        if i + BATCH_SIZE < len(translatable):
            time.sleep(1)

    # Verify coverage
    missing = [
        seg["id"] for seg in translatable
        if seg["id"] not in all_translations
    ]
    if missing:
        print(
            f"  WARNING: {len(missing)} segments missing translations: "
            f"{missing[:5]}{'...' if len(missing) > 5 else ''}",
            file=sys.stderr,
        )

    # Build and write output
    translated = build_translated_segments(english_data, all_translations, lang_code)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(translated, f, indent=2, ensure_ascii=False)

    print(f"  Wrote {output_path} ({translated['total_segments']} segments)")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Translate segments to multiple languages")
    parser.add_argument("pack_dir", type=Path, help="Path to pack directory")
    parser.add_argument(
        "--langs",
        default=",".join(ALL_LANGS),
        help="Comma-separated language codes (default: all 22)",
    )
    args = parser.parse_args()

    langs = [l.strip() for l in args.langs.split(",")]
    english_data = load_segments(args.pack_dir)

    print(f"Source: {args.pack_dir / 'segments.json'}")
    print(f"Total segments: {english_data['total_segments']}")
    print(f"Languages: {', '.join(f'{l} ({LANG_NAMES.get(l, l)})' for l in langs)}")

    client = anthropic.Anthropic()  # Uses ANTHROPIC_API_KEY env var

    for lang_code in langs:
        translate_language(client, english_data, lang_code, args.pack_dir)

    print(f"\nDone! Translated to {len(langs)} languages.")


if __name__ == "__main__":
    main()
