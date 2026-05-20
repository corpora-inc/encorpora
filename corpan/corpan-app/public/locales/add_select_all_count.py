#!/usr/bin/env python3
"""
Patch `onboarding.phrasePacks.selectAll` in every locale so it includes
the `{{count}}` interpolation placeholder. The original Phase B i18n
rollout shipped this key as just "Select all" in most locales and
"Select all {{count}}" in English only — which caused the English UI to
render the literal `{{count}}` string (the component now passes a count
parameter alongside, but every locale must opt in to the placeholder).

Behavior, per locale:
  - If the current value already contains `{{count}}`, leave it alone.
  - Otherwise, append " ({{count}})" to whatever's there.

This preserves each locale's authored phrasing and just tacks on a
culturally-safe parenthesized count suffix. Idempotent — re-running is a
no-op once all locales are patched.

Run:
    python3 public/locales/add_select_all_count.py public/locales/
"""
import json
import os
import sys


KEY_PATH = ["onboarding", "phrasePacks", "selectAll"]
TOKEN = "{{count}}"


def get_in(d, path):
    cur = d
    for p in path:
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur


def set_in(d, path, value):
    cur = d
    for p in path[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[path[-1]] = value


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path, data):
    if isinstance(data, dict) and "$schema" in data:
        ordered = {"$schema": data["$schema"]}
        for k, v in data.items():
            if k == "$schema":
                continue
            ordered[k] = v
        data = ordered
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    if not os.path.isdir(root):
        print(f"Not a directory: {root}")
        sys.exit(1)

    patched = 0
    skipped_already_ok = 0
    skipped_missing_key = 0
    for lang_dir in sorted(os.listdir(root)):
        lang_path = os.path.join(root, lang_dir)
        if not os.path.isdir(lang_path):
            continue
        common_path = os.path.join(lang_path, "common.json")
        if not os.path.isfile(common_path):
            continue
        try:
            data = load_json(common_path)
        except Exception as e:
            print(f"SKIP (invalid JSON): {common_path} -> {e}")
            continue
        current = get_in(data, KEY_PATH)
        if current is None:
            # Key wasn't seeded by the Phase B rollout — leave it alone;
            # the component will fall back to `defaultValue`.
            skipped_missing_key += 1
            continue
        if not isinstance(current, str):
            print(f"SKIP (non-string value): {common_path}")
            continue
        if TOKEN in current:
            skipped_already_ok += 1
            continue
        # Trim any trailing punctuation/whitespace before appending the
        # parenthesized count so we get "Select all (12)" not
        # "Select all. (12)".
        new_value = f"{current.rstrip(' .…')} ({TOKEN})"
        set_in(data, KEY_PATH, new_value)
        dump_json(common_path, data)
        patched += 1
        print(f"Patched {common_path}: {current!r} -> {new_value!r}")

    print(
        f"\nDone. Patched: {patched}  "
        f"Already had {{{{count}}}}: {skipped_already_ok}  "
        f"Missing key: {skipped_missing_key}"
    )


if __name__ == "__main__":
    main()
