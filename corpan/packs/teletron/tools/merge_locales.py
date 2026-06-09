#!/usr/bin/env python3
"""Merge per-batch translation fragments into tools/locales.json + sanity-check.

The localization fan-out writes tools/loc_frag_*.json, each a JSON object
{ "<locale>": { "<key>": "<value>", ... }, ... }. This merges them all into
tools/locales.json (ready for `gen_i18n.py --from-json`), and LOUDLY rejects the
failure mode a prior run hit: placeholder "stub" values (e.g. "Teletron · <key>"
or a value identical to its English source / key name). Run from packs/teletron.
"""
import json, re, sys, pathlib, glob

HERE = pathlib.Path(__file__).resolve().parent
EN = json.loads((HERE / "en_source.json").read_text())
EN_KEYS = set(EN)

EXPECTED = ['es','ar','bg','bn','ca','cs','da','de','el','fa','fi','fr','gu','he','hi','hr','hu','id','it','ja','kn','ko-polite','lt','mr','ms','ne','nl','no','pa-Arab','pa-Guru','pl','pt-BR','pt-PT','ro','ru','sk','sl','sr','sv','sw','ta','te','th','tr','uk','ur','vi','yue-Hant-HK','zh-Hans','zh-Hant']

# The codex stub signature was "<word> Teletron · <key>" — a middot, and the value
# ENDS WITH the camelCase key name. A plain "Teletron-" is NOT a stub: many
# languages hyphenate case endings onto the brand (Teletron-এর, Teletron-Version).
STUB_RE = re.compile(r"Teletron\s*·")


def looks_stub(key: str, value: str) -> bool:
    if not value or not value.strip():
        return True
    if STUB_RE.search(value):
        return True
    # value is literally the key name, or a "<word> · <key>" placeholder template
    if value.strip() == key or value.strip().endswith(key):
        return True
    return False


def main() -> int:
    merged: dict[str, dict] = {}
    for frag in sorted(glob.glob(str(HERE / "loc_frag_*.json"))):
        data = json.loads(pathlib.Path(frag).read_text())
        for code, d in data.items():
            if isinstance(d, dict):
                merged.setdefault(code, {}).update(d)

    problems = []
    for code in EXPECTED:
        d = merged.get(code)
        if not d:
            problems.append(f"MISSING locale: {code}")
            continue
        missing = EN_KEYS - set(d)
        if missing:
            problems.append(f"{code}: missing {len(missing)} keys e.g. {sorted(missing)[:3]}")
        stubs = [k for k, v in d.items() if k in EN_KEYS and looks_stub(k, str(v))]
        if stubs:
            problems.append(f"{code}: {len(stubs)} STUB/empty values e.g. {stubs[:3]}")

    extra = sorted(set(merged) - set(EXPECTED))
    if extra:
        problems.append(f"unexpected locales: {extra}")

    out = HERE / "locales.json"
    out.write_text(json.dumps(merged, ensure_ascii=False, indent=2))
    print(f"merged {len(merged)} locales x {len(EN_KEYS)} keys -> {out}")
    if problems:
        print("\n!!! PROBLEMS (do NOT inject until fixed):")
        for p in problems:
            print("  -", p)
        return 1
    print("OK: all 50 locales present, all keys, no stubs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
