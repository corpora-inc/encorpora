#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Add a localized display name for Thai to:
  - languages.th
  - dialects.th
in each locales/*/common.json file (including the Bengali locale folder).

Idempotent: if a non-empty value already exists, it will not be changed.

Usage (run from public/locales):
    python3 add_th.py
"""

import json
from pathlib import Path

# Localized names for “Thai” per locale folder name
LOCALE_TO_TH_NAME = {
    "en": "Thai",
    "ar": "التايلاندية",
    "bn": "থাই",
    "de": "Thailändisch",
    "es": "Tailandés",
    "fa": "تایلندی",
    "fr": "Thaï",
    "hi": "थाई",
    "hu": "Thai",
    "it": "Thai",
    "ja": "タイ語",
    "ko-polite": "태국어",
    "pl": "Tajski",
    "pt-BR": "Tailandês",
    "ru": "Тайский",
    "th": "ไทย",
    "vi": "Tiếng Thái",
    "zh-Hans": "泰语",
    "zh-Hant": "泰語",
}


def _needs_write(obj: dict, key_path: list[str], value: str) -> bool:
    """
    Return True if the value at obj[key_path...] is missing or empty and should be set to value.
    """
    cur = obj
    for k in key_path[:-1]:
        v = cur.get(k)
        if not isinstance(v, dict):
            return (
                True  # parent missing or wrong type → we'll overwrite with a dict later
            )
        cur = v
    leaf_key = key_path[-1]
    existing = cur.get(leaf_key)
    return not (isinstance(existing, str) and existing.strip())


def _set_value(obj: dict, key_path: list[str], value: str) -> None:
    """
    Ensure intermediate dicts exist and set obj[key_path...] = value.
    """
    cur = obj
    for k in key_path[:-1]:
        if not isinstance(cur.get(k), dict):
            cur[k] = {}
        cur = cur[k]
    cur[key_path[-1]] = value


def main():
    root = Path(__file__).resolve().parent
    changed_languages = 0
    changed_dialects = 0
    skipped_languages = 0
    skipped_dialects = 0

    for locale_dir in sorted(root.iterdir()):
        if not locale_dir.is_dir():
            continue
        if locale_dir.name in {".git", "__pycache__"}:
            continue

        common_path = locale_dir / "common.json"
        if not common_path.exists():
            continue

        try:
            data = json.loads(common_path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[WARN] Could not read {common_path}: {e}")
            continue

        th_label = LOCALE_TO_TH_NAME.get(locale_dir.name, "Thai")

        # languages.th
        if _needs_write(data, ["languages", "th"], th_label):
            _set_value(data, ["languages", "th"], th_label)
            changed_languages += 1
            print(f"[OK] {common_path}: languages.th → {th_label}")
        else:
            skipped_languages += 1

        # dialects.th (to mirror base code entries alongside region-specific ones like th-TH)
        if _needs_write(data, ["dialects", "th"], th_label):
            _set_value(data, ["dialects", "th"], th_label)
            changed_dialects += 1
            print(f"[OK] {common_path}: dialects.th → {th_label}")
        else:
            skipped_dialects += 1

        # Write back prettified JSON (UTF-8 intact)
        try:
            common_path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        except Exception as e:
            print(f"[ERROR] Failed to write {common_path}: {e}")

    print(
        "\nDone."
        f" languages.th → updated: {changed_languages}, skipped: {skipped_languages};"
        f" dialects.th → updated: {changed_dialects}, skipped: {skipped_dialects}"
    )


if __name__ == "__main__":
    main()
