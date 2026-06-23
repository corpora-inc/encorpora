#!/usr/bin/env python3
"""Incrementally translate ONE i18n sub-block into every locale.

Reads the `onboarding.welcomePact` block from en/common.json and, for each
locale that doesn't already have it, asks codex (GPT-5.x) to translate just
that block into the locale's language, then inserts it TEXTUALLY right after
the `"onboarding": {` line — so the other ~670 keys are left byte-for-byte
untouched (no full-file rewrite, minimal diff).

Idempotent: locales that already contain `"welcomePact"` are skipped.

Usage:
  python translate_welcomepact.py            # all locales
  python translate_welcomepact.py fr de pl   # only these
"""
from __future__ import annotations

import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

_HERE = Path(__file__).resolve()
_DJA = _HERE.parents[1]            # .../corpan/dja
sys.path.insert(0, str(_DJA))
from cor.utils import codex        # noqa: E402

LOCALES = _DJA.parent / "corpan-app" / "public" / "locales"
BLOCK = "welcomePact"
PARENT = "onboarding"
SKIP = {"en", "ar", "__pycache__"}

SYSTEM = """You are a professional localizer for Corpán, a language-learning \
app made by a tiny two-person team. Translate the given English UI strings into \
{language} ({code}). This screen is a warm, candid, lightly-humorous note shown \
to a brand-new user right after they pick their language — it sets expectations \
(tiny team, bleeding-edge, things may break) and asks them, heartfelt, to send \
feedback instead of a low rating. Match that tone in {language}; sound like a \
real human, not a machine.

ABSOLUTE RULES:
1. Return ONLY a JSON object with EXACTLY these keys, same order, no extras:
   {keys}
2. Preserve every placeholder like {{{{lang}}}} VERBATIM (double braces). \
{{{{lang}}}} is the user's language name, inserted at runtime — never translate \
or remove it.
3. Keep these tokens in Latin script, unchanged: Corpán, GitHub. Keep the \
email team@encorpora.io and the number 50 as-is. Keep the emoji 🤝.
4. Translate meaning, not word-for-word. Make it idiomatic and natural.
5. No code fences, no commentary — just the JSON object."""


def translate(code: str, language: str, block: dict) -> dict:
    keys = ", ".join(block.keys())
    sys_prompt = SYSTEM.format(language=language, code=code, keys=keys)
    prompt = sys_prompt + "\n\nEnglish source:\n" + json.dumps(block, ensure_ascii=False, indent=2)
    out = codex.run_json(prompt, reasoning="medium", timeout=300.0)
    if not isinstance(out, dict):
        raise ValueError(f"{code}: expected object, got {type(out)}")
    missing = [k for k in block if k not in out]
    if missing:
        raise ValueError(f"{code}: missing keys {missing}")
    # Placeholder integrity: every {{...}} in the English value must survive.
    import re
    for k, v in block.items():
        want = set(re.findall(r"\{\{[^}]+\}\}", v))
        got = set(re.findall(r"\{\{[^}]+\}\}", str(out.get(k, ""))))
        if want - got:
            raise ValueError(f"{code}.{k}: lost placeholder {want - got}")
    return {k: out[k] for k in block}  # exact key order


def block_text(block: dict) -> str:
    body = json.dumps(block, ensure_ascii=False, indent=2).split("\n")
    lines = [f'    "{BLOCK}": {{']
    lines += ["    " + l for l in body[1:-1]]   # inner keys → 6-space indent
    lines.append("    },")
    return "\n".join(lines)


def insert(code: str, block: dict) -> None:
    path = LOCALES / code / "common.json"
    text = path.read_text(encoding="utf-8")
    if f'"{BLOCK}"' in text:
        return
    src = text.split("\n")
    anchor = next(i for i, l in enumerate(src) if l.strip().startswith(f'"{PARENT}": {{'))
    src[anchor + 1:anchor + 1] = block_text(block).split("\n")
    out = "\n".join(src)
    json.loads(out)  # fail loudly if we broke the file
    path.write_text(out, encoding="utf-8")


def main():
    en = json.loads((LOCALES / "en" / "common.json").read_text(encoding="utf-8"))
    block = en[PARENT][BLOCK]
    names = en["languages"]
    only = set(sys.argv[1:])
    targets = []
    for d in sorted(LOCALES.iterdir()):
        if not d.is_dir() or d.name in SKIP:
            continue
        if only and d.name not in only:
            continue
        if f'"{BLOCK}"' in (d / "common.json").read_text(encoding="utf-8"):
            continue
        targets.append(d.name)
    print(f"Translating {BLOCK} into {len(targets)} locales…", flush=True)

    results = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(translate, c, names.get(c, c), block): c for c in targets}
        for fut in as_completed(futs):
            c = futs[fut]
            try:
                results[c] = fut.result()
                print(f"  {c} ✓", flush=True)
            except Exception as e:
                print(f"  {c} FAILED: {e}", file=sys.stderr, flush=True)

    for c, blk in results.items():
        insert(c, blk)
    print(f"\nInserted into {len(results)}/{len(targets)} locales.")
    failed = [c for c in targets if c not in results]
    if failed:
        print(f"FAILED (re-run to retry): {failed}")


if __name__ == "__main__":
    main()
