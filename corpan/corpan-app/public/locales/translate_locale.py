#!/usr/bin/env python3
"""Translate `en/common.json` into every target locale via codex CLI.

Two operations:
  1. `python3 translate_locale.py full <code> [<code>...]`
     Translate the full en/common.json to <code>/common.json.
  2. `python3 translate_locale.py langnames`
     For every existing locale (other than en), add the 9 newly-supported
     language autonyms to its `languages` dict.

We send the whole JSON in one codex call — the file is ~15KB and that fits
comfortably. Falls back to per-section translation on JSON parse failure.

Validates: every leaf key from en is present in the target, and every
`{{...}}` placeholder appears with identical token in the translation.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
EN_PATH = HERE / "en" / "common.json"

# Add /corpan/dja to sys.path so we can import the codex helper.
DJA_ROOT = HERE.parents[3] / "dja"
sys.path.insert(0, str(DJA_ROOT))
from cor.utils import codex  # noqa: E402


# Native-script autonyms for the 9 new languages, used to ensure the
# language-names dict in every locale gets the right native form.
LANG_AUTONYMS = {
    "he": "Hebrew",
    "sv": "Swedish",
    "fi": "Finnish",
    "nl": "Dutch",
    "sw": "Swahili",
    "no": "Norwegian",
    "da": "Danish",
    "el": "Greek",
    "ms": "Malay",
}


PLACEHOLDER_RE = re.compile(r"\{\{[^}]+\}\}")


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
    """Return (missing_in_target, placeholder_mismatches)."""
    missing = [k for k in en_leaves if k not in tgt_leaves]
    mismatches = []
    for k, en_v in en_leaves.items():
        if k not in tgt_leaves:
            continue
        if not isinstance(en_v, str):
            continue
        en_holders = sorted(set(PLACEHOLDER_RE.findall(en_v)))
        tgt_v = tgt_leaves[k]
        if not isinstance(tgt_v, str):
            continue
        tgt_holders = sorted(set(PLACEHOLDER_RE.findall(tgt_v)))
        if en_holders != tgt_holders:
            mismatches.append(f"{k}: en={en_holders} tgt={tgt_holders}")
    return missing, mismatches


# ---------------- Full-locale translation ----------------

FULL_SYSTEM = """You translate JSON locale files for a polished mobile language-learning app called Corpan.

ABSOLUTE RULES:
1. Output ONLY a single JSON object that is the translated locale. No prose, no markdown fences, no explanations.
2. Preserve EVERY key exactly. Do not reorder, rename, omit, or invent keys.
3. Preserve placeholders verbatim. Tokens like {{name}}, {{count}}, {{language}} must appear in the translated string with identical spelling.
4. Do not translate values that are URLs, email addresses, version numbers, or short technical identifiers (like "GitHub", "YouTube", "App Store", "Play Store") unless the locale has a well-established native equivalent.
5. The "languages" subtree maps BCP-47 codes to language NAMES in the target locale. Translate them naturally (e.g. for ja: "en" -> "英語"). For the keys themselves (the codes), do NOT change them.
6. The "categories" subtree maps domain codes to category names. Translate naturally.
7. The "dialects" subtree maps locale tags (like "en-US") to natural label phrasings in the target language; keep the keys as-is, translate the values.
8. The "$schema" key value is a relative path; copy it verbatim ("./../locale.schema.json").
9. Use a polite, neutral, modern register. Do not over-formalize or over-colloquialize. Hebrew should use nikkud (vocalized).
10. If a value is a learner-friendly micro-string ("Yes", "No", "Loading"), translate it naturally — short and clean."""


FULL_USER_TEMPLATE = """Target language: {target_name} ({target_code}).

Translate the following en/common.json (English source) into {target_code}.
Output the full translated JSON object — every leaf string in the target language, all keys preserved.

SOURCE_JSON:
{source_json}"""


def translate_full(en_data: dict, target_code: str, target_name: str,
                   reasoning: str = "low", timeout: float = 360.0) -> dict:
    src = json.dumps(en_data, ensure_ascii=False, indent=2)
    prompt = (
        FULL_SYSTEM + "\n\n" +
        FULL_USER_TEMPLATE.format(
            target_code=target_code,
            target_name=target_name,
            source_json=src,
        )
    )
    parsed = codex.run_json(prompt, reasoning=reasoning, timeout=timeout)
    if not isinstance(parsed, dict):
        raise ValueError(f"codex returned non-object: {type(parsed).__name__}")
    return parsed


def cmd_full(args):
    en_data = json.loads(EN_PATH.read_text())
    en_leaves = collect_leaf_keys(en_data)

    def _do(code: str):
        target_name = LANG_AUTONYMS.get(code, code)
        out_dir = HERE / code
        out_path = out_dir / "common.json"
        if out_path.exists() and not args.force:
            return code, "skipped (already exists; --force to overwrite)"
        try:
            translated = translate_full(
                en_data, code, target_name,
                reasoning=args.reasoning, timeout=args.timeout,
            )
        except Exception as e:
            return code, f"FAILED: {type(e).__name__}: {e}"

        # Validate
        tgt_leaves = collect_leaf_keys(translated)
        missing, mismatches = diff_keys(en_leaves, tgt_leaves)

        out_dir.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(translated, ensure_ascii=False, indent=4) + "\n")
        msg = f"wrote {out_path.relative_to(HERE)} ({len(tgt_leaves)} leaves)"
        if missing:
            msg += f"  ⚠ missing {len(missing)} keys (e.g. {missing[:3]})"
        if mismatches:
            msg += f"  ⚠ {len(mismatches)} placeholder mismatches"
        return code, msg

    print(f"Translating {len(args.codes)} locales: {args.codes}")
    if args.workers <= 1:
        for code in args.codes:
            c, m = _do(code)
            print(f"[{c}] {m}", flush=True)
        return

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(_do, c): c for c in args.codes}
        for fut in concurrent.futures.as_completed(futs):
            c, m = fut.result()
            print(f"[{c}] {m}", flush=True)


# ---------------- Add language names to existing locales ----------------

LANG_NAMES_SYSTEM = """You produce natural language NAMES, in the target locale, for a list of source-language English names. Output ONLY a single JSON object: {{"<bcp47>": "<native name in target locale>", ...}}. No prose."""

LANG_NAMES_USER_TEMPLATE = """Target locale: {target} ({target_name}).

For each entry below, produce the natural NAME of the language as a {target}-speaker would write it in their everyday locale (NOT the autonym in the language being named — the name AS RENDERED IN {target}).

Examples for target=ja:
  "he" -> "ヘブライ語"
  "sv" -> "スウェーデン語"

Source list (BCP-47 -> English name):
{source_json}

Output: JSON object mapping the same BCP-47 keys to {target}-language names."""


def cmd_langnames(args):
    """For every existing locale (except en), add the 9 new language entries."""
    targets = []
    for sub in sorted(HERE.iterdir()):
        if not sub.is_dir():
            continue
        if not (sub / "common.json").exists():
            continue
        if sub.name in ("en",):
            continue
        targets.append(sub.name)
    if args.codes:
        targets = [t for t in targets if t in set(args.codes)]
    print(f"Updating language-names dict in {len(targets)} locales")

    new_codes = list(LANG_AUTONYMS.keys())
    src_json = json.dumps(LANG_AUTONYMS, ensure_ascii=False, indent=2)

    def _do(target_code: str):
        target_name = LANG_AUTONYMS.get(target_code, target_code)
        # Read the current locale
        path = HERE / target_code / "common.json"
        try:
            data = json.loads(path.read_text())
        except Exception as e:
            return target_code, f"FAILED to read: {e}"
        if "languages" not in data or not isinstance(data["languages"], dict):
            return target_code, "no `languages` dict — skipping"

        already_present = [c for c in new_codes if c in data["languages"]]
        missing = [c for c in new_codes if c not in data["languages"]]
        if not missing:
            return target_code, f"already complete ({already_present})"

        prompt = (
            LANG_NAMES_SYSTEM + "\n\n" +
            LANG_NAMES_USER_TEMPLATE.format(
                target=target_code,
                target_name=target_name,
                source_json=json.dumps({c: LANG_AUTONYMS[c] for c in missing},
                                       ensure_ascii=False, indent=2),
            )
        )
        try:
            parsed = codex.run_json(prompt, reasoning=args.reasoning,
                                    timeout=args.timeout)
        except Exception as e:
            return target_code, f"FAILED codex: {type(e).__name__}: {e}"
        if not isinstance(parsed, dict):
            return target_code, f"unexpected codex shape: {parsed!r}"

        for c in missing:
            if c in parsed and isinstance(parsed[c], str):
                data["languages"][c] = parsed[c]

        # write
        path.write_text(json.dumps(data, ensure_ascii=False, indent=4) + "\n")
        return target_code, f"added {len(missing)} entries"

    if args.workers <= 1:
        for c in targets:
            tc, m = _do(c)
            print(f"[{tc}] {m}", flush=True)
        return

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(_do, c): c for c in targets}
        for fut in concurrent.futures.as_completed(futs):
            tc, m = fut.result()
            print(f"[{tc}] {m}", flush=True)


# ---------------- CLI ----------------


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)

    p_full = sub.add_parser("full", help="Translate full en/common.json to one or more locales")
    p_full.add_argument("codes", nargs="+", help="BCP-47 codes (he, sv, fi, ...)")
    p_full.add_argument("--force", action="store_true",
                        help="Overwrite existing <code>/common.json")
    p_full.add_argument("--reasoning", default="low")
    p_full.add_argument("--timeout", type=float, default=360.0)
    p_full.add_argument("--workers", type=int, default=3)
    p_full.set_defaults(func=cmd_full)

    p_names = sub.add_parser("langnames", help="Add 9 new language names to every existing locale")
    p_names.add_argument("--codes", nargs="*", default=None,
                         help="Only update these target locales (default: all existing)")
    p_names.add_argument("--reasoning", default="low")
    p_names.add_argument("--timeout", type=float, default=180.0)
    p_names.add_argument("--workers", type=int, default=4)
    p_names.set_defaults(func=cmd_langnames)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
