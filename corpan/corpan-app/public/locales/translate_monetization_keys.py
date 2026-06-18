#!/usr/bin/env python3
"""Translate the monetization/streak UI keys (code field, daily-lock, trial
framing, streak badge) into every locale via OpenAI. Diff-based: for each
locale it translates exactly the keys present in en/common.json but missing
there, and merges them only-if-missing (never clobbers existing translations).

Run (from this dir), AWS-style env not needed; reads OPENAI_API_KEY from the
repo-root .env:
    ../../../infra/play/.venv/bin/python translate_monetization_keys.py            # dry-run es
    ../../../infra/play/.venv/bin/python translate_monetization_keys.py --apply     # write all
    ... --only es                                                                   # one locale
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).parent
REPO_ENV = HERE / "../../../../.env"  # repo root .env
MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")

LANG_NAMES: dict[str, str] = {
    "ar": "Arabic", "bg": "Bulgarian", "bn": "Bengali", "ca": "Catalan",
    "cs": "Czech", "da": "Danish", "de": "German", "el": "Greek",
    "es": "Spanish", "fa": "Persian (Farsi)", "fi": "Finnish", "fr": "French",
    "gu": "Gujarati", "he": "Hebrew", "hi": "Hindi", "hr": "Croatian",
    "hu": "Hungarian", "id": "Indonesian", "it": "Italian", "ja": "Japanese",
    "jv": "Javanese", "kn": "Kannada",
    "ko-polite": "Korean (polite/존댓말 register)", "lt": "Lithuanian",
    "mr": "Marathi", "ms": "Malay", "ne": "Nepali", "nl": "Dutch",
    "no": "Norwegian", "pa-Arab": "Punjabi (Shahmukhi/Arabic script)",
    "pa-Guru": "Punjabi (Gurmukhi script)", "pl": "Polish",
    "pt-BR": "Brazilian Portuguese", "pt-PT": "European Portuguese",
    "ro": "Romanian", "ru": "Russian", "sk": "Slovak", "sl": "Slovenian",
    "sr": "Serbian", "su": "Sundanese", "sv": "Swedish", "sw": "Swahili",
    "ta": "Tamil", "te": "Telugu", "th": "Thai", "tl": "Tagalog (Filipino)",
    "tr": "Turkish", "uk": "Ukrainian", "ur": "Urdu", "vi": "Vietnamese",
    "yue-Hant-HK": "Cantonese (Traditional, Hong Kong)",
    "zh-Hans": "Simplified Chinese", "zh-Hant": "Traditional Chinese",
}


def load_key() -> str:
    # repo-root .env: KEY=value lines
    for line in REPO_ENV.resolve().read_text().splitlines():
        if line.startswith("OPENAI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("OPENAI_API_KEY not found in repo .env")


def flatten(tree: dict, prefix: str = "") -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in tree.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            out.update(flatten(v, key + "."))
        elif isinstance(v, str):
            out[key] = v
    return out


def build_prompt(name: str, payload: dict[str, str]) -> str:
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    return f"""You are a senior app localizer. Translate the following UI strings from English into {name} for a privacy-first language-learning app called Corpán.

HARD RULES:
- Keep these brand names EXACTLY as-is, never translate or transliterate: "Corpán", "Corpán Plus", "Plus".
- Preserve EVERY placeholder EXACTLY, including double braces and the name inside: {{{{count}}}}, {{{{unit}}}}, {{{{days}}}}, {{{{time}}}}, {{{{price}}}}, {{{{period}}}}, {{{{title}}}}. Never translate text inside braces.
- Concise and natural for a mobile UI in {name} — match length/tone, not word-for-word.
- Warm, calm, dignified register (an ad-free indie app, never a hard sell). No exclamation-mark hype.
- Return ONLY a JSON object with the SAME keys as the input, values translated into {name}. No commentary.

INPUT (key -> English):
{body}
"""


def translate_locale(lang: str, en_flat: dict[str, str], client) -> tuple[str, dict | None, str]:
    name = LANG_NAMES.get(lang, lang)
    path = HERE / lang / "common.json"
    if not path.is_file():
        return lang, None, "no common.json"
    loc_flat = flatten(json.loads(path.read_text()))
    missing = {k: en_flat[k] for k in en_flat if k not in loc_flat}
    if not missing:
        return lang, {}, "already complete"
    try:
        resp = client.chat.completions.create(
            model=MODEL,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": build_prompt(name, missing)}],
        )
        data = json.loads(resp.choices[0].message.content)
        if not isinstance(data, dict):
            return lang, None, "not a dict"
        absent = [k for k in missing if k not in data]
        if absent:
            return lang, None, f"missing {len(absent)} keys back"
        return lang, {k: str(data[k]) for k in missing}, f"ok ({len(missing)})"
    except Exception as e:
        return lang, None, f"{type(e).__name__}: {str(e)[:160]}"


def set_path(tree: dict, dotted: str, value: str) -> None:
    parts = dotted.split(".")
    node = tree
    for p in parts[:-1]:
        node = node.setdefault(p, {})
        if not isinstance(node, dict):
            return
    node.setdefault(parts[-1], value)  # only-missing


def merge_into_locale(lang: str, flat: dict[str, str], apply: bool) -> int:
    path = HERE / lang / "common.json"
    data = json.loads(path.read_text())
    before = json.dumps(data, ensure_ascii=False)
    for k, v in flat.items():
        set_path(data, k, v)
    after = json.dumps(data, ensure_ascii=False)
    if apply and before != after:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    return 1 if before != after else 0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--only", default=None)
    args = ap.parse_args()

    from openai import OpenAI
    client = OpenAI(api_key=load_key())

    en_flat = flatten(json.loads((HERE / "en" / "common.json").read_text()))
    targets = [args.only] if args.only else list(LANG_NAMES.keys())

    results: dict[str, dict] = {}
    errors: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = {ex.submit(translate_locale, lang, en_flat, client): lang for lang in targets}
        for fut in as_completed(futs):
            lang, flat, status = fut.result()
            if flat is None:
                errors[lang] = status
                print(f"  ✗ {lang}: {status}", file=sys.stderr)
            else:
                results[lang] = flat
                print(f"  ✓ {lang}: {status}")

    written = sum(merge_into_locale(lang, flat, args.apply) for lang, flat in results.items() if flat)
    print(f"\n{'APPLIED' if args.apply else 'DRY RUN'}: {len(results)} ok, "
          f"{written} files {'updated' if args.apply else 'would change'}, {len(errors)} errors.")
    if errors:
        print("Errors:", errors)
        sys.exit(1)


if __name__ == "__main__":
    main()
