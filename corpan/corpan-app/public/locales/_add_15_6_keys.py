#!/usr/bin/env python3
"""One-shot: translate the 12 new 0.15.6 keys into every non-en locale and
merge them into the existing common.json without touching any other key.

Run from the repo root:
    python3 corpan-app/public/locales/_add_15_6_keys.py
"""
from __future__ import annotations

import concurrent.futures
import json
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
EN_PATH = HERE / "en" / "common.json"

# Add /corpan/dja to sys.path so we can import the codex helper.
# HERE = .../corpan/corpan-app/public/locales — dja is at parents[2]/dja.
DJA_ROOT = HERE.parents[2] / "dja"
sys.path.insert(0, str(DJA_ROOT))
from cor.utils import codex  # noqa: E402

# The 12 new keys added in 0.15.6. Each entry: (dotted path, English string).
# Dotted paths use "." for nesting and have no array/index syntax (safe — none of these are in arrays).
NEW_KEYS: list[tuple[str, str]] = [
    ("settings.sendAnonUsage", "Send anonymous usage data"),
    ("settings.sendAnonUsageHint",
     "Anonymous, session-scoped. No accounts, no device IDs, no IP storage. Toggle off any time."),
    ("settings.readPrivacyPromise", "Read our Privacy Promise"),
    ("packs.phrasePack.inactiveBadge", "Inactive"),
    ("packs.phrasePack.moreActionsLabel", "More actions"),
    ("subscription.pendingHeading", "Waiting for approval"),
    ("subscription.pendingDetail",
     "Your subscription is awaiting approval (Ask to Buy or bank verification). It will activate automatically once approved."),
    ("subscription.storeUnreachable", "We couldn't reach the App Store right now."),
    ("subscription.tryAgain", "Try again"),
    ("onboarding.appleNoVoiceTitle", "Apple doesn't ship a {{lang}} voice yet"),
    ("onboarding.appleNoVoiceBody",
     "A quick note to Apple's accessibility team helps make the case. {{lang}} works natively on Android in the meantime."),
]

PLACEHOLDER_RE = re.compile(r"\{\{[^}]+\}\}")


def all_locales() -> list[str]:
    out = []
    for p in sorted(HERE.iterdir()):
        if not p.is_dir() or p.name in ("en", "__pycache__"):
            continue
        if (p / "common.json").exists():
            out.append(p.name)
    return out


def load_locale(code: str) -> dict:
    with (HERE / code / "common.json").open(encoding="utf-8") as f:
        return json.load(f)


def dump_locale(code: str, data: dict) -> None:
    path = HERE / code / "common.json"
    tmp = path.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    tmp.replace(path)


def set_at_path(data: dict, dotted: str, value: str) -> None:
    parts = dotted.split(".")
    cursor = data
    for k in parts[:-1]:
        if k not in cursor or not isinstance(cursor[k], dict):
            cursor[k] = {}
        cursor = cursor[k]
    cursor[parts[-1]] = value


def get_at_path(data: dict, dotted: str) -> object | None:
    parts = dotted.split(".")
    cursor = data
    for k in parts:
        if not isinstance(cursor, dict) or k not in cursor:
            return None
        cursor = cursor[k]
    return cursor


PROMPT_TEMPLATE = """You translate UI strings for Corpán, a polished mobile language-learning app.

Target locale: {code}

Translate the following English strings into the target locale. Output ONLY a single JSON object whose keys match the dotted paths exactly and whose values are the translations. No prose, no markdown fences.

RULES:
1. Preserve every {{{{...}}}} placeholder verbatim (same spelling, same braces). Example: {{{{lang}}}} stays {{{{lang}}}}.
2. Translate naturally for the target locale's everyday register — concise, polite, app-UI tone.
3. Don't translate brand names: "Corpán", "Apple", "Android", "iOS", "App Store", "Play Store".
4. Don't add or remove keys. Output exactly the same dotted-path keys you receive.
5. If a key looks like a short button label ("Try again", "Inactive"), match the brevity in translation.

English strings:
{payload}
"""


def translate_one(code: str, force: bool = False) -> tuple[str, str, dict | str]:
    """Returns (code, status, payload-or-error)."""
    try:
        existing = load_locale(code)
    except Exception as e:
        return code, "load-failed", str(e)

    # Identify which keys actually need work in THIS locale. If a key
    # already exists and isn't a copy of the English string, skip it.
    to_translate: list[tuple[str, str]] = []
    for path, en_val in NEW_KEYS:
        cur = get_at_path(existing, path)
        if force or cur is None or cur == en_val:
            to_translate.append((path, en_val))

    if not to_translate:
        return code, "skip-already-present", {}

    payload = json.dumps({p: v for p, v in to_translate}, ensure_ascii=False, indent=2)
    prompt = PROMPT_TEMPLATE.format(code=code, payload=payload)

    try:
        translated = codex.run_json(prompt, reasoning="low", timeout=240.0)
    except Exception as e:
        return code, "codex-error", str(e)

    if not isinstance(translated, dict):
        return code, "non-dict-response", str(translated)[:200]

    # Validate placeholders match.
    bad_holders = []
    for path, en_val in to_translate:
        tgt = translated.get(path)
        if not isinstance(tgt, str):
            return code, "missing-key", path
        en_h = sorted(set(PLACEHOLDER_RE.findall(en_val)))
        tgt_h = sorted(set(PLACEHOLDER_RE.findall(tgt)))
        if en_h != tgt_h:
            bad_holders.append((path, en_h, tgt_h))
    if bad_holders:
        return code, "placeholder-mismatch", bad_holders

    # Merge into existing locale and write.
    for path, _ in to_translate:
        set_at_path(existing, path, translated[path])
    dump_locale(code, existing)
    return code, "ok", {p: translated[p] for p, _ in to_translate}


def main():
    codes = all_locales()
    print(f"Found {len(codes)} non-en locales: {' '.join(codes)}", file=sys.stderr)

    results: dict[str, tuple[str, object]] = {}
    t0 = time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(translate_one, c): c for c in codes}
        for fut in concurrent.futures.as_completed(futures):
            code = futures[fut]
            try:
                _, status, payload = fut.result()
            except Exception as e:
                status, payload = "thread-error", repr(e)
            results[code] = (status, payload)
            sym = "ok" if status == "ok" else status
            print(f"  [{code}] {sym}", file=sys.stderr)

    elapsed = time.monotonic() - t0
    ok = sum(1 for v in results.values() if v[0] == "ok")
    skip = sum(1 for v in results.values() if v[0] == "skip-already-present")
    other = len(results) - ok - skip
    print(
        f"\nDone in {elapsed:.1f}s — {ok} translated, {skip} skipped (already had keys), "
        f"{other} need attention",
        file=sys.stderr,
    )
    for code, (status, payload) in sorted(results.items()):
        if status not in ("ok", "skip-already-present"):
            print(f"  ⚠️  {code}: {status} — {str(payload)[:200]}", file=sys.stderr)


if __name__ == "__main__":
    main()
