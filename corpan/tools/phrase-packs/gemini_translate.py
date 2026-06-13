#!/usr/bin/env python3
"""
Parallel Gemini translation orchestrator for phrase packs.

Reads `<pack-dir>/pack.json` + `<pack-dir>/phrases.json`, then dispatches
one Gemini 2.5 Flash call per target language (ThreadPoolExecutor). Each
call:

  - asks for a structured JSON response keyed by string index "0".."{n-1}"
  - includes target-language self-system-prompt instruction
  - includes per-language regional/script/romanization notes
  - is validated server-side via response_schema, then locally
  - writes `<pack-dir>/translations/<lang>.json` directly

Default backend: AI Studio (GEMINI_API_KEY). Use --vertex to route through
Vertex AI on project corpora1 (requires GOOGLE_APPLICATION_CREDENTIALS).

Usage:
  python gemini_translate.py <pack-dir>
                             [--langs es,fr,...]
                             [--workers 12]
                             [--model gemini-2.5-flash]
                             [--vertex]
                             [--write-en]
                             [--temperature 0.2]
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path.home() / ".env")

from google import genai
from google.genai import types as gtypes


# Mirrors corpan-app/src/store/settings.ts :: ALL_LANGUAGES.
ALL_LANGS = (
    "en", "es", "ca", "fr", "it", "ro", "pt-PT", "pt-BR",
    "de", "nl", "no", "sv", "da", "fi", "hu",
    "lt", "pl", "cs", "sk", "sl", "hr", "sr", "bg", "uk", "ru",
    "el", "tr",
    "he", "ar", "fa", "ur", "pa-Arab",
    "pa-Guru", "hi", "ne", "bn", "mr", "gu", "kn", "te", "ta",
    "th", "vi", "id", "jv", "su", "ms", "tl",
    "sw",
    "zh-Hans", "zh-Hant", "yue-Hant-HK", "ko-polite", "ja",
)

LANG_NAME = {
    "es": "Spanish", "ca": "Catalan", "fr": "French", "it": "Italian", "ro": "Romanian",
    "pt-PT": "European Portuguese", "pt-BR": "Brazilian Portuguese",
    "de": "German", "nl": "Dutch", "no": "Norwegian Bokmål", "sv": "Swedish",
    "da": "Danish", "fi": "Finnish", "hu": "Hungarian",
    "lt": "Lithuanian", "pl": "Polish", "cs": "Czech", "sk": "Slovak", "sl": "Slovenian",
    "hr": "Croatian", "sr": "Serbian (Latin script)", "bg": "Bulgarian",
    "uk": "Ukrainian", "ru": "Russian",
    "el": "Modern Greek", "tr": "Turkish",
    "he": "Modern Hebrew", "ar": "Modern Standard Arabic", "fa": "Persian (Farsi)",
    "ur": "Urdu", "pa-Arab": "Punjabi (Shahmukhi script)",
    "pa-Guru": "Punjabi (Gurmukhi script)", "hi": "Hindi", "ne": "Nepali",
    "bn": "Bengali", "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada",
    "te": "Telugu", "ta": "Tamil",
    "th": "Thai", "vi": "Vietnamese", "id": "Indonesian (Bahasa Indonesia)",
    "jv": "Javanese (Basa Jawa, Latin script)",
    "su": "Sundanese (Basa Sunda, Latin script)",
    "ms": "Malay (Bahasa Malaysia)", "tl": "Tagalog (Filipino, Latin script)",
    "sw": "Swahili (Kiswahili)",
    "zh-Hans": "Simplified Mandarin Chinese", "zh-Hant": "Traditional Mandarin Chinese (Taiwan)",
    "yue-Hant-HK": "Hong Kong written Cantonese (Traditional script)",
    "ko-polite": "Korean (polite forms only)", "ja": "Japanese",
}

ROMANIZED = {
    "bg", "uk", "ru", "el", "he", "ar", "fa", "ur", "pa-Arab", "pa-Guru",
    "hi", "ne", "bn", "mr", "gu", "kn", "te", "ta", "th",
    "zh-Hans", "zh-Hant", "yue-Hant-HK", "ko-polite", "ja",
}

ROMANIZATION_STYLE = {
    "bg": "Streamlined Latin transliteration",
    "uk": "Ukrainian National 2010 system",
    "ru": "BGN/PCGN",
    "el": "ELOT 743 or ISO 843",
    "he": "common Modern Hebrew transliteration (e.g. 'shalom')",
    "ar": "ALA-LC style with long vowels (ā ī ū)",
    "fa": "DMG/UniPers style with ezāfe marked",
    "ur": "Roman Urdu (common readable style)",
    "pa-Arab": "ALA-LC style for Punjabi",
    "pa-Guru": "ISO 15919 for Gurmukhi",
    "hi": "IAST with proper diacritics (ā ī ū ṛ ṇ ś ṣ ñ ṅ)",
    "ne": "IAST or comparable readable transliteration",
    "bn": "ISO 15919 / IAST-adjacent",
    "mr": "IAST with proper diacritics",
    "gu": "ISO 15919 for Gujarati",
    "kn": "ISO 15919 for Kannada",
    "te": "ISO 15919 for Telugu",
    "ta": "ISO 15919 for Tamil",
    "th": "Royal Thai General System (RTGS)",
    "zh-Hans": "Pinyin with tone marks (ā á ǎ à), word-grouped spacing",
    "zh-Hant": "Pinyin with tone marks, word-grouped spacing",
    "yue-Hant-HK": "Jyutping with tone numbers (1-6)",
    "ko-polite": "Revised Romanization of Korean (2000)",
    "ja": "Modified Hepburn (long vowels with macrons: ō ū)",
}

LANG_NOTES = {
    "pt-PT": "European Portuguese vocabulary: comboio (not trem), telemóvel (not celular), pequeno-almoço (not café da manhã). Post-Acordo Ortográfico spelling.",
    "pt-BR": "Brazilian Portuguese: você standard, trem (not comboio), celular (not telemóvel), café da manhã (not pequeno-almoço).",
    "no": "Norwegian Bokmål, not Nynorsk.",
    "sr": "Use Serbian Latin script (Latinica), NOT Cyrillic.",
    "fi": "Standard written Finnish (yleiskieli) with conversational warmth.",
    "he": "Modern conversational Hebrew. Omit niqqud unless ambiguous.",
    "ar": "Modern Standard Arabic (MSA), conversational tone. Omit tashkīl unless ambiguous.",
    "fa": "Modern conversational Persian, Iranian dialect.",
    "ur": "Modern conversational Urdu, subcontinental usage, Nastaliq.",
    "pa-Arab": "Pakistani Punjabi in Shahmukhi. NOT Urdu-in-Shahmukhi.",
    "pa-Guru": "Indian Punjabi in Gurmukhi. NOT Hindi-in-Gurmukhi.",
    "hi": "Modern conversational Hindi. Use tum for second person (warm, learner-appropriate).",
    "bn": "Modern Cholito-bhasha Bengali. Use tumi for second person.",
    "id": "Standard Bahasa Indonesia. Distinct from Bahasa Malaysia.",
    "jv": "Modern conversational Javanese in Latin script. Use Ngoko alus / broadly understandable polite-neutral wording; avoid Indonesian calques and avoid Javanese script.",
    "su": "Modern conversational Sundanese in Latin script. Use polite-neutral standard Basa Sunda; avoid Indonesian calques and avoid Sundanese script.",
    "ms": "Standard Bahasa Malaysia (Bahasa Melayu Baku). Distinct from Bahasa Indonesia.",
    "tl": "Modern conversational Tagalog/Filipino in Latin script, natural Manila-standard usage. Avoid over-Spanish or overly formal register unless the English demands it.",
    "sw": "Standard East African Kiswahili sanifu.",
    "zh-Hans": "Simplified characters, Mainland Mandarin. NOT Cantonese vocabulary.",
    "zh-Hant": "Traditional characters, Taiwan Mandarin (影片 not 视频, 軟體 not 软件). NOT Cantonese.",
    "yue-Hant-HK": (
        "Written Hong Kong Cantonese in Traditional script. Vernacular as Hong Kongers write it. "
        "USE: 唔 (not 不), 嘅 (not 的), 啲 (not 些), 咗 for completed aspect, 嚟 (not 來), 喺 (not 在), "
        "咩/乜嘢 (not 什麼), 點解 (not 為什麼), 識, 我哋/你哋/佢哋, 係 (not 是), and Cantonese particles "
        "(啦/喎/喇/㗎/咩/呀/啊). The most common failure is writing Mandarin in Traditional characters — DON'T."
    ),
    "ko-polite": "Polite forms only: 해요체 (default, warm) or 합니다체. NEVER 반말. Avoid English calques.",
    "ja": "Default to です/ます polite-neutral. Use natural Japanese sentence patterns — don't mirror English clause structure. Subject pronouns often dropped.",
}


def build_prompt(lang: str, topic: str, n: int, phrases: list[dict]) -> str:
    name = LANG_NAME[lang]
    note = LANG_NOTES.get(lang, "")
    if lang in ROMANIZED:
        rom = (f"For EVERY entry, include a Latin romanization in {ROMANIZATION_STYLE[lang]}. "
               f"Populate the `romanization` field for all {n} entries.")
    else:
        rom = f"`romanization` is `null` for every entry ({name} uses Latin script)."

    phrase_lines = "\n".join(f"{i}. {p['english']}" for i, p in enumerate(phrases))

    note_block = f"\nLANGUAGE-SPECIFIC NOTES:\n{note}\n" if note else ""

    return f"""You are a native, literate speaker of {name} (BCP-47 code: {lang}). Translate the following {n} English phrases (topic: {topic}) for a language-learning app.

QUALITY BAR (top priority):
- Natural, conversational, modern. Not literal or stiff.
- Each translation should land as if originally written in {name}, the way a fluent local would actually phrase it.
- Adapt idioms. Never word-for-word for figurative language.
- Register: neutral conversational with a slight warmth, friendly learning-app tone.
- Topic-specific vocabulary ({topic}) should be precise but accessible.

BEFORE TRANSLATING (do this internally, no need to output):
Compose your own translator system prompt IN {name}. Cover register, regional flavor, topic vocabulary, and a one-line idiom-handling rule. Translate against that internal prompt. Self-prompting IN {name} keeps your output in natural {name} cadence rather than English-shaped {name}.
{note_block}
ROMANIZATION: {rom}

OUTPUT: Return a JSON object with exactly {n} entries, keys "0" through "{n-1}" as JSON strings. Each value is an object with `text` (non-empty {name} translation) and `romanization` (per the rule above).

ENGLISH PHRASES (indexed 0..{n-1}):
{phrase_lines}
"""


def make_client(vertex: bool):
    if vertex:
        project = os.environ.get("GOOGLE_CLOUD_PROJECT", "corpora1")
        location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
        return genai.Client(vertexai=True, project=project, location=location)
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise SystemExit("GEMINI_API_KEY missing (and --vertex not set)")
    return genai.Client(api_key=key)


def translate_one(lang: str, client, model: str, pack_dir: Path, topic: str,
                  phrases: list[dict], temperature: float,
                  skip_existing: bool = False) -> tuple[str, str, float, int]:
    """Translate one language. Returns (lang, status, duration_s, output_bytes)."""
    out_path = pack_dir / "translations" / f"{lang}.json"
    out_path.parent.mkdir(exist_ok=True)
    n = len(phrases)

    # Skip if a complete, well-formed file already exists.
    if skip_existing and out_path.is_file():
        try:
            existing = json.loads(out_path.read_text())
            if (isinstance(existing, dict)
                    and len(existing) == n
                    and all(str(i) in existing
                            and isinstance(existing[str(i)], dict)
                            and existing[str(i)].get("text", "").strip()
                            for i in range(n))):
                return (lang, "SKIP (already complete)", 0.0, out_path.stat().st_size)
        except (json.JSONDecodeError, OSError):
            pass  # treat as missing, retranslate

    prompt = build_prompt(lang, topic, n, phrases)

    t0 = time.time()
    try:
        resp = client.models.generate_content(
            model=model,
            contents=prompt,
            config=gtypes.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=65536,
                response_mime_type="application/json",
            ),
        )
    except Exception as e:
        return (lang, f"API_ERROR: {type(e).__name__}: {str(e)[:200]}", time.time() - t0, 0)

    dur = time.time() - t0
    text = (resp.text or "").strip()
    if not text:
        return (lang, "EMPTY_RESPONSE", dur, 0)

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        return (lang, f"BAD_JSON: {e}", dur, len(text))

    if not isinstance(data, dict):
        return (lang, f"NOT_DICT: type={type(data).__name__}", dur, len(text))
    if len(data) != n:
        return (lang, f"COUNT_MISMATCH: got {len(data)}, expected {n}", dur, len(text))

    # Normalize: ensure every entry has 'text' and 'romanization' (None if missing)
    normalized = {}
    for i in range(n):
        k = str(i)
        if k not in data:
            return (lang, f"MISSING_KEY: {k}", dur, len(text))
        entry = data[k]
        if not isinstance(entry, dict) or "text" not in entry:
            return (lang, f"BAD_ENTRY at {k}", dur, len(text))
        rom = entry.get("romanization")
        if isinstance(rom, str) and not rom.strip():
            rom = None
        normalized[k] = {"text": entry["text"], "romanization": rom}

    out_path.write_text(json.dumps(normalized, ensure_ascii=False, indent=2))
    return (lang, "OK", dur, out_path.stat().st_size)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("pack_dir", help="Path to the pack input directory")
    p.add_argument("--langs", help="Comma-separated codes (default: all 51 minus en)")
    p.add_argument("--workers", type=int, default=12, help="Concurrent workers (default 12)")
    p.add_argument("--model", default="gemini-2.5-flash", help="Gemini model (default gemini-2.5-flash)")
    p.add_argument("--vertex", action="store_true", help="Use Vertex AI on corpora1 (else GEMINI_API_KEY)")
    p.add_argument("--temperature", type=float, default=0.2)
    p.add_argument("--write-en", action="store_true",
                   help="Also generate en.json directly from phrases.json (no model call)")
    p.add_argument("--skip-existing", action="store_true",
                   help="Skip languages whose translations/<lang>.json already has all entries valid")
    ns = p.parse_args()

    pack_dir = Path(ns.pack_dir).resolve()
    if not pack_dir.is_dir():
        raise SystemExit(f"not a directory: {pack_dir}")
    meta = json.loads((pack_dir / "pack.json").read_text())
    phrases = json.loads((pack_dir / "phrases.json").read_text())
    n = len(phrases)
    topic = meta.get("topic", meta.get("name", "general"))
    print(f"[orchestrator] pack={meta['id']} v{meta['version']}  n={n}  topic={topic}")

    if ns.write_en:
        en = {str(i): {"text": p["english"], "romanization": None} for i, p in enumerate(phrases)}
        en_path = pack_dir / "translations" / "en.json"
        en_path.parent.mkdir(exist_ok=True)
        en_path.write_text(json.dumps(en, ensure_ascii=False, indent=2))
        print(f"[en] wrote {en_path}: {len(en)} entries")

    langs = (tuple(s.strip() for s in ns.langs.split(",") if s.strip())
             if ns.langs else tuple(l for l in ALL_LANGS if l != "en"))

    client = make_client(ns.vertex)
    backend = "Vertex AI / corpora1" if ns.vertex else "AI Studio (GEMINI_API_KEY)"
    print(f"[orchestrator] {ns.model} via {backend}, {len(langs)} langs, {ns.workers} workers, temp={ns.temperature}")

    t0 = time.time()
    results: list[tuple[str, str, float, int]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=ns.workers) as pool:
        futs = {pool.submit(translate_one, l, client, ns.model, pack_dir, topic, phrases,
                            ns.temperature, ns.skip_existing): l for l in langs}
        for fut in concurrent.futures.as_completed(futs):
            lang, status, dur, sz = fut.result()
            marker = "✓" if status == "OK" else "✗"
            print(f"  {marker} {lang:<14} {dur:>6.1f}s  {sz:>7}B  {status}")
            results.append((lang, status, dur, sz))

    elapsed = time.time() - t0
    ok = sum(1 for _, s, _, _ in results if s == "OK")
    print(f"\n[orchestrator] {ok}/{len(langs)} OK in {elapsed:.1f}s")
    if ok < len(langs):
        print("[orchestrator] failed:")
        for l, s, _, _ in results:
            if s != "OK":
                print(f"  - {l}: {s}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
