#!/usr/bin/env python3
"""Translate en/common.json into target locales via the OpenAI API directly.

Bypasses codex CLI rate limits. Same FULL_SYSTEM rubric as translate_locale.py.

Usage (from corpan-app/public/locales):

    OPENAI_API_KEY=sk-... python3 translate_locale_openai.py ne pt-PT hr sr ...

Reads en/common.json, prompts the model to produce the equivalent translated
JSON object, validates that every leaf key is present and every {{placeholder}}
appears unchanged, then writes <code>/common.json.

Set TRANSLATE_LOCALE_MODEL to override the default (gpt-4o-mini).
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path.home() / ".env")

HERE = Path(__file__).resolve().parent
EN_PATH = HERE / "en" / "common.json"
MODEL = os.environ.get("TRANSLATE_LOCALE_MODEL", "gpt-4o-mini")
PLACEHOLDER_RE = re.compile(r"\{\{[^}]+\}\}")


# Native autonyms for the 13 new languages (rendered AS the locale itself).
LANG_AUTONYMS: dict[str, str] = {
    "ne": "नेपाली",
    "pt-PT": "Português (europeu)",
    "hr": "hrvatski",
    "sr": "српски",
    "uk": "українська",
    "bg": "български",
    "ro": "română",
    "ca": "català",
    "yue-Hant-HK": "粵語（繁體，香港）",
    "cs": "čeština",
    "lt": "lietuvių",
    "sk": "slovenčina",
    "sl": "slovenščina",
    "jv": "Basa Jawa",
    "su": "Basa Sunda",
    "tl": "Tagalog",
}


FULL_SYSTEM = """You translate JSON locale files for a polished mobile language-learning app called Corpán.

ABSOLUTE RULES:
1. Output ONLY a single JSON object — the translated locale. No prose, no markdown fences.
2. Preserve EVERY key exactly. Do not reorder, rename, omit, or invent keys.
3. Preserve placeholders verbatim. Tokens like {{name}}, {{count}}, {{language}} must appear in the translated string with identical spelling.
4. Do not translate values that are URLs, email addresses, version numbers, or short technical identifiers (like "GitHub", "YouTube", "App Store", "Play Store") unless the locale has a well-established native equivalent.
5. The "languages" subtree maps BCP-47 codes to language NAMES in the target locale. Translate them naturally (e.g. for ja: "en" -> "英語"). For the keys themselves (the codes), do NOT change them.
6. The "categories" subtree maps domain codes to category names. Translate naturally.
7. The "dialects" subtree maps locale tags (like "en-US") to natural label phrasings in the target language; keep the keys as-is, translate the values.
8. The "$schema" key value is a relative path; copy it verbatim ("./../locale.schema.json").
9. Use a polite, neutral, modern register. Do not over-formalize or over-colloquialize.
10. For Cantonese (yue-Hant-HK), write in HK Cantonese using Traditional characters; vernacular characters (係, 喺, 唔, 嘅, 咗) are welcome.
11. For European Portuguese (pt-PT), reject Brazilian vocab/structure: 'autocarro' not 'ônibus', 'comboio' not 'trem', 'estou a fazer' not 'estou fazendo', etc.
12. For Serbian (sr), write in Cyrillic, ekavian variant.
13. For Javanese (jv), write in Latin-script Basa Jawa, polite-neutral Ngoko alus where possible; do not use Javanese script.
14. For Sundanese (su), write in Latin-script Basa Sunda, polite-neutral standard wording; do not use Sundanese script.
15. For Tagalog (tl), write natural modern Tagalog/Filipino in Latin script.
16. If a value is a learner-friendly micro-string ("Yes", "No", "Loading"), translate naturally — short and clean."""


def collect_leaf_keys(d, prefix=""):
    out = {}
    if isinstance(d, dict):
        for k, v in d.items():
            sub = f"{prefix}.{k}" if prefix else k
            out.update(collect_leaf_keys(v, sub))
    elif isinstance(d, list):
        for i, v in enumerate(d):
            out.update(collect_leaf_keys(v, f"{prefix}[{i}]"))
    else:
        out[prefix] = d
    return out


def diff_keys(en_leaves: dict, tgt_leaves: dict) -> tuple[list[str], list[str]]:
    missing = [k for k in en_leaves if k not in tgt_leaves]
    mismatches = []
    for k, en_v in en_leaves.items():
        if k not in tgt_leaves or not isinstance(en_v, str):
            continue
        tgt_v = tgt_leaves[k]
        if not isinstance(tgt_v, str):
            continue
        en_h = sorted(set(PLACEHOLDER_RE.findall(en_v)))
        tgt_h = sorted(set(PLACEHOLDER_RE.findall(tgt_v)))
        if en_h != tgt_h:
            mismatches.append(f"{k}: en={en_h} tgt={tgt_h}")
    return missing, mismatches


def translate_full(client: OpenAI, en_data: dict,
                   target_code: str, target_name: str) -> dict:
    src = json.dumps(en_data, ensure_ascii=False, indent=2)
    user = (
        f"Target language: {target_name} ({target_code}).\n\n"
        f"Translate the following en/common.json into {target_code}.\n"
        f"Output the full translated JSON object — every leaf string in the "
        f"target language, all keys preserved.\n\n"
        f"SOURCE_JSON:\n{src}"
    )
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": FULL_SYSTEM},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )
    content = resp.choices[0].message.content or "{}"
    parsed = json.loads(content)
    if not isinstance(parsed, dict):
        raise ValueError(f"non-object response: {type(parsed).__name__}")
    return parsed


def do_one(client: OpenAI, en_data: dict, en_leaves: dict,
           code: str, force: bool) -> tuple[str, str]:
    target_name = LANG_AUTONYMS.get(code, code)
    out_dir = HERE / code
    out_path = out_dir / "common.json"
    if out_path.exists() and not force:
        return code, "skipped (exists; use --force)"

    try:
        translated = translate_full(client, en_data, code, target_name)
    except Exception as exc:
        return code, f"FAILED: {type(exc).__name__}: {exc}"

    tgt_leaves = collect_leaf_keys(translated)
    missing, mismatches = diff_keys(en_leaves, tgt_leaves)

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(translated, ensure_ascii=False, indent=4) + "\n")

    msg = f"wrote ({len(tgt_leaves)} leaves)"
    if missing:
        msg += f"  ⚠ missing {len(missing)} keys (e.g. {missing[:3]})"
    if mismatches:
        msg += f"  ⚠ {len(mismatches)} placeholder mismatches"
    return code, msg


def main():
    p = argparse.ArgumentParser()
    p.add_argument("codes", nargs="+", help="BCP-47 target codes")
    p.add_argument("--force", action="store_true",
                   help="Overwrite existing <code>/common.json")
    p.add_argument("--workers", type=int, default=4)
    args = p.parse_args()

    en_data = json.loads(EN_PATH.read_text())
    en_leaves = collect_leaf_keys(en_data)
    client = OpenAI()

    print(f"Translating {len(args.codes)} locales: {args.codes} (model={MODEL})")
    if args.workers <= 1:
        for code in args.codes:
            c, m = do_one(client, en_data, en_leaves, code, args.force)
            print(f"[{c}] {m}", flush=True)
        return

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(do_one, client, en_data, en_leaves, c, args.force): c
                for c in args.codes}
        for fut in concurrent.futures.as_completed(futs):
            c, m = fut.result()
            print(f"[{c}] {m}", flush=True)


if __name__ == "__main__":
    main()
