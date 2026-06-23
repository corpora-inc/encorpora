#!/usr/bin/env python3
"""Fill in untranslated language NAMES across locales via the OpenAI API.

When `add_new_langs.py` couldn't find a hand-curated label for a given
(locale × new-lang) pair, it fell back to the English name. This script
audits every locale's `languages` block, picks out the cells whose value
still equals the English name (signal for "untranslated"), and asks
the model for proper native renderings — one batched request per locale.

Idempotent: cells whose value differs from the English name are left
alone. Re-runs only touch entries that are still English.

Usage (from corpan-app/public/locales):

    OPENAI_API_KEY=sk-... \
    /path/to/dja/.venv/bin/python fix_lang_names_openai.py
"""

from __future__ import annotations

import concurrent.futures
import json
import os
import sys
from pathlib import Path

from openai import OpenAI


HERE = Path(__file__).resolve().parent
EN_PATH = HERE / "en" / "common.json"
MODEL = os.environ.get("FIX_LANG_NAMES_MODEL", "gpt-4o-mini")
WORKERS = 6

NEW_LANGS = [
    "ne", "pt-PT", "hr", "sr", "uk", "bg", "ro", "ca",
    "yue-Hant-HK", "cs", "lt", "sk", "sl",
]
EN_NAMES = {
    "ne": "Nepali",
    "pt-PT": "Portuguese (European)",
    "hr": "Croatian",
    "sr": "Serbian",
    "uk": "Ukrainian",
    "bg": "Bulgarian",
    "ro": "Romanian",
    "ca": "Catalan",
    "yue-Hant-HK": "Cantonese (Traditional)",
    "cs": "Czech",
    "lt": "Lithuanian",
    "sk": "Slovak",
    "sl": "Slovenian",
}

# Display names for target locales (just to help the model — many models
# do better with both code and name in the prompt).
TARGET_LOCALE_NAMES = {
    "ar": "Arabic", "bg": "Bulgarian", "bn": "Bengali", "ca": "Catalan",
    "cs": "Czech", "da": "Danish", "de": "German", "el": "Greek",
    "es": "Spanish", "fa": "Persian", "fi": "Finnish", "fr": "French",
    "gu": "Gujarati", "he": "Hebrew", "hi": "Hindi", "hr": "Croatian",
    "hu": "Hungarian", "id": "Indonesian", "it": "Italian", "ja": "Japanese",
    "kn": "Kannada", "ko-polite": "Korean (polite register)",
    "lt": "Lithuanian", "mr": "Marathi", "ms": "Malay", "ne": "Nepali",
    "nl": "Dutch", "no": "Norwegian", "pa-Arab": "Punjabi (Shahmukhi)",
    "pa-Guru": "Punjabi (Gurmukhi)", "pl": "Polish",
    "pt-BR": "Portuguese (Brazilian)", "pt-PT": "Portuguese (European)",
    "ro": "Romanian", "ru": "Russian", "sk": "Slovak", "sl": "Slovenian",
    "sr": "Serbian", "sv": "Swedish", "sw": "Swahili", "ta": "Tamil",
    "te": "Telugu", "th": "Thai", "tr": "Turkish", "uk": "Ukrainian",
    "ur": "Urdu", "vi": "Vietnamese",
    "yue-Hant-HK": "Cantonese (HK, Traditional)",
    "zh-Hans": "Chinese (Simplified)", "zh-Hant": "Chinese (Traditional)",
}


SYSTEM = """You produce natural language NAMES, in the target locale, for a list of source-language English names.
Output ONLY a single JSON object: {"<bcp47>": "<native name in target locale>", ...}. No prose, no markdown fences.
The KEYS are BCP-47 codes — DO NOT change them. The VALUES are how a speaker of the target locale would naturally write that language's name.
Use the script and conventions of the target locale. For Cantonese (Traditional), prefer the locale's natural rendering (e.g., Japanese: 広東語（繁体字）)."""


def find_untranslated(data: dict) -> list[str]:
    langs = data.get("languages", {})
    if not isinstance(langs, dict):
        return []
    return [
        c for c in NEW_LANGS
        if isinstance(langs.get(c), str) and langs[c] == EN_NAMES[c]
    ]


def request_translations(client: OpenAI, target_code: str,
                         missing: list[str]) -> dict[str, str]:
    target_name = TARGET_LOCALE_NAMES.get(target_code, target_code)
    src = {c: EN_NAMES[c] for c in missing}
    user = (
        f"Target locale: {target_code} ({target_name}).\n"
        f"Source list (BCP-47 → English name):\n"
        f"{json.dumps(src, ensure_ascii=False, indent=2)}\n\n"
        f"Output: JSON object mapping the same BCP-47 keys to {target_code}-language names."
    )
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )
    parsed = json.loads(resp.choices[0].message.content or "{}")
    if not isinstance(parsed, dict):
        raise ValueError(f"non-object response: {parsed!r}")
    # Filter: keep only string values for known missing codes.
    return {
        c: parsed[c]
        for c in missing
        if isinstance(parsed.get(c), str) and parsed[c].strip()
    }


def fix_one(client: OpenAI, target_code: str) -> tuple[str, str]:
    p = HERE / target_code / "common.json"
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        return target_code, f"FAILED to read: {e}"

    missing = find_untranslated(data)
    if not missing:
        return target_code, "already complete"

    try:
        translations = request_translations(client, target_code, missing)
    except Exception as e:
        return target_code, f"FAILED LLM: {type(e).__name__}: {e}"

    # Apply only to languages dict; mirror to dialects dict if present.
    langs = data.setdefault("languages", {})
    dialects = data.get("dialects")
    n_langs = 0
    n_dialects = 0
    for c, v in translations.items():
        if isinstance(langs.get(c), str) and langs[c] == EN_NAMES[c]:
            langs[c] = v
            n_langs += 1
        if isinstance(dialects, dict) and isinstance(dialects.get(c), str) and dialects[c] == EN_NAMES[c]:
            dialects[c] = v
            n_dialects += 1

    p.write_text(json.dumps(data, ensure_ascii=False, indent=4) + "\n",
                 encoding="utf-8")
    skipped = len(missing) - n_langs
    msg = f"updated languages.{n_langs}, dialects.{n_dialects}"
    if skipped:
        msg += f", skipped {skipped} (model didn't return them)"
    return target_code, msg


def main():
    # Find all locale dirs needing work.
    targets: list[str] = []
    for d in sorted(HERE.iterdir()):
        if not d.is_dir():
            continue
        if d.name in ("__pycache__", ".git", "en"):
            continue
        if not (d / "common.json").exists():
            continue
        try:
            data = json.loads((d / "common.json").read_text(encoding="utf-8"))
        except Exception:
            continue
        if find_untranslated(data):
            targets.append(d.name)

    if not targets:
        print("Nothing to fix — every locale's new-lang names are already translated.")
        return

    print(f"Locales needing fixes: {len(targets)} → {targets}")
    print(f"Model: {MODEL}, workers: {WORKERS}")

    client = OpenAI()
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(fix_one, client, t): t for t in targets}
        for fut in concurrent.futures.as_completed(futs):
            code, msg = fut.result()
            print(f"[{code}] {msg}", flush=True)


if __name__ == "__main__":
    main()
