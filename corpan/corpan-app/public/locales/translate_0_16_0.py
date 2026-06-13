#!/usr/bin/env python3
"""Translate the Corpán 0.16.0 i18n delta into all 50 locales via Gemini Flash on Vertex.

Reads the current EN `common.json` as the source of truth, computes the per-locale
missing-key delta plus a force-overwrite set (EN strings whose copy changed on this
branch), translates with brand/placeholder discipline, and merges results back.

- Missing keys: filled in (only where absent — never clobbers existing translations).
- Force-overwrite keys: replaced with fresh translations regardless of what's there.

Run:  /home/skyl/tts_venv/bin/python translate_0_16_0.py [--apply]
Dry run by default (translates + prints, writes nothing).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path.home() / ".env")

from google import genai
from google.genai import types as gtypes

HERE = Path(__file__).parent
MODEL = "gemini-2.5-flash"

# EN strings whose copy changed on this branch — translations are stale and must
# be replaced. All other delta keys are merged only-if-missing.
FORCE_OVERWRITE_KEYS: list[str] = [
    "onboarding.openVoiceSettings",
    "onboarding.ttsOsTipIOS",
    "onboarding.ttsOsTipMac",
    "onboarding.ttsRescue.engineNotInstalled.detail",
]

# Locale dir -> human language name for the prompt.
LANG_NAMES: dict[str, str] = {
    "ar": "Arabic", "bg": "Bulgarian", "bn": "Bengali", "ca": "Catalan",
    "cs": "Czech", "da": "Danish", "de": "German", "el": "Greek",
    "es": "Spanish", "fa": "Persian (Farsi)", "fi": "Finnish", "fr": "French",
    "gu": "Gujarati", "he": "Hebrew", "hi": "Hindi", "hr": "Croatian",
    "hu": "Hungarian", "id": "Indonesian", "jv": "Javanese", "it": "Italian", "ja": "Japanese",
    "kn": "Kannada", "ko-polite": "Korean (polite/존댓말 register)", "lt": "Lithuanian",
    "mr": "Marathi", "ms": "Malay", "ne": "Nepali", "nl": "Dutch",
    "no": "Norwegian", "pa-Arab": "Punjabi (Shahmukhi/Arabic script)",
    "pa-Guru": "Punjabi (Gurmukhi script)", "pl": "Polish",
    "pt-BR": "Brazilian Portuguese", "pt-PT": "European Portuguese",
    "ro": "Romanian", "ru": "Russian", "sk": "Slovak", "sl": "Slovenian",
    "sr": "Serbian", "su": "Sundanese", "sv": "Swedish", "sw": "Swahili", "ta": "Tamil",
    "te": "Telugu", "th": "Thai", "tl": "Tagalog", "tr": "Turkish", "uk": "Ukrainian",
    "ur": "Urdu", "vi": "Vietnamese", "yue-Hant-HK": "Cantonese (Traditional, Hong Kong)",
    "zh-Hans": "Simplified Chinese", "zh-Hant": "Traditional Chinese",
}


def flatten(d: dict, prefix: str = "") -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out


def load_en_payload() -> dict[str, str]:
    """Return the dotted-flat EN map for the union of (missing across any
    non-EN locale) ∪ FORCE_OVERWRITE_KEYS."""
    en = json.loads((HERE / "en" / "common.json").read_text())
    fen = flatten(en)

    needed: set[str] = set()
    for d in sorted(HERE.iterdir()):
        if not d.is_dir() or d.name == "en":
            continue
        path = d / "common.json"
        if not path.is_file():
            continue
        fl = flatten(json.loads(path.read_text()))
        for k in fen:
            if k not in fl:
                needed.add(k)

    for k in FORCE_OVERWRITE_KEYS:
        if k in fen:
            needed.add(k)

    return {k: fen[k] for k in sorted(needed)}


def make_client():
    project = os.environ.get("GOOGLE_CLOUD_PROJECT", "corpora1")
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
    return genai.Client(vertexai=True, project=project, location=location)


def build_prompt(name: str, payload: dict[str, str]) -> str:
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    return f"""You are a senior app localizer. Translate the following UI strings from English into {name} for a privacy-first language-learning app called Corpán.

HARD RULES:
- Keep the brand names EXACTLY as-is, never translate or transliterate: "Corpán", "Corpán Plus", "Corpanista", "Corpanistas", "Parlometron", "Hanzipan", "Earthgate Reader", "Stargate Reader", "World Radio", "Hover Runner", "Juice Squeeze", "Phrase Flip".
- Preserve every placeholder EXACTLY, including the double braces: {{{{title}}}}, {{{{count}}}}, {{{{lang}}}}, {{{{n}}}}, {{{{total}}}}, {{{{active}}}}, {{{{version}}}}, {{{{name}}}}. Do not translate text inside braces.
- Apple product / setting names: keep platform-canonical wording for {name} ("Settings", "Accessibility", "Spoken Content", "Voices", "System Settings", "Manage Voices", "System Voice", "Premium", "Enhanced"). If the OS uses localized names in {name}, use those.
- Keep it concise and natural for a mobile UI in {name} — match length/tone, not word-for-word.
- Warm, calm, non-pushy register (this is an ad-free indie app, not a hard-sell).
- Return ONLY a JSON object with the SAME keys as the input, values translated into {name}. No commentary, no markdown, just JSON.

INPUT (key -> English):
{body}
"""


def translate_locale(lang: str, en_payload: dict[str, str], client) -> tuple[str, dict | None, str]:
    name = LANG_NAMES.get(lang, lang)
    try:
        resp = client.models.generate_content(
            model=MODEL,
            contents=build_prompt(name, en_payload),
            config=gtypes.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=16384,
                response_mime_type="application/json",
            ),
        )
        text = (resp.text or "").strip()
        data = json.loads(text)
        if not isinstance(data, dict):
            return lang, None, "not a dict"
        missing = [k for k in en_payload if k not in data]
        if missing:
            return lang, None, f"missing {len(missing)} keys (first: {missing[:3]})"
        return lang, {k: str(data[k]) for k in en_payload}, "ok"
    except Exception as e:
        return lang, None, f"{type(e).__name__}: {str(e)[:200]}"


def set_path(tree: dict, dotted: str, value: str, overwrite: bool) -> None:
    parts = dotted.split(".")
    node = tree
    for p in parts[:-1]:
        nxt = node.get(p)
        if not isinstance(nxt, dict):
            nxt = {}
            node[p] = nxt
        node = nxt
    if overwrite or parts[-1] not in node:
        node[parts[-1]] = value


def merge_into_locale(lang: str, flat: dict[str, str], apply: bool) -> tuple[int, int]:
    """Returns (filled_missing, overwritten)."""
    path = HERE / lang / "common.json"
    if not path.is_file():
        return 0, 0
    data = json.loads(path.read_text())
    fl_before = flatten(data)
    filled = 0
    overwritten = 0
    force = set(FORCE_OVERWRITE_KEYS)
    for k, v in flat.items():
        if k in force:
            if fl_before.get(k) != v:
                set_path(data, k, v, overwrite=True)
                overwritten += 1
        else:
            if k not in fl_before:
                set_path(data, k, v, overwrite=False)
                filled += 1
    if apply and (filled or overwritten):
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    return filled, overwritten


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--only", default=None, help="comma-separated locales for testing")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    en_payload = load_en_payload()
    print(f"EN payload: {len(en_payload)} keys "
          f"({len(FORCE_OVERWRITE_KEYS)} force-overwrite, rest = missing-key union)")

    targets = (
        [t.strip() for t in args.only.split(",")]
        if args.only else list(LANG_NAMES.keys())
    )
    client = make_client()

    results: dict[str, dict] = {}
    errors: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(translate_locale, lang, en_payload, client): lang for lang in targets}
        for fut in as_completed(futs):
            lang, flat, status = fut.result()
            if flat is None:
                errors[lang] = status
                print(f"  ✗ {lang}: {status}", file=sys.stderr)
            else:
                results[lang] = flat
                print(f"  ✓ {lang}")

    total_filled = 0
    total_overwritten = 0
    for lang, flat in results.items():
        f, o = merge_into_locale(lang, flat, args.apply)
        total_filled += f
        total_overwritten += o

    verb = "APPLIED" if args.apply else "DRY RUN"
    print(
        f"\n{verb}: {len(results)} locales translated. "
        f"filled={total_filled} keys, overwritten={total_overwritten} keys. "
        f"{len(errors)} errors."
    )
    if errors:
        print("Errors:", json.dumps(errors, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
