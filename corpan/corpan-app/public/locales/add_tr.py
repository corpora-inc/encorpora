#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Add a localized display name for Turkish to:
  - languages.tr
  - dialects.tr
in each locales/*/common.json file.

Idempotent: if a non-empty value already exists, it will not be changed.

Usage (run from public/locales):
    python3 add_tr.py
"""

import json
from pathlib import Path

# Localized names for “Turkish” per locale folder name (Title/Display case where applicable)
LOCALE_TO_TR_NAME = {
    "en": "Turkish",
    "ar": "التركية",
    "bn": "তুর্কি",
    "de": "Türkisch",
    "es": "Turco",
    "fa": "ترکی",
    "fr": "Turc",
    "hi": "तुर्की",
    "hu": "Török",
    "it": "Turco",
    "ja": "トルコ語",
    "ko-polite": "터키어",
    "pl": "Turecki",
    "pt-BR": "Turco",
    "ru": "Турецкий",
    "vi": "Tiếng Thổ Nhĩ Kỳ",
    "zh-Hans": "土耳其语",
    "zh-Hant": "土耳其語",
    "id": "Bahasa Turki",
    "tr": "Türkçe",  # autonym in Turkish
    # Unknown locales fall back to English label:
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

        tr_label = LOCALE_TO_TR_NAME.get(locale_dir.name, "Turkish")

        # languages.tr
        if _needs_write(data, ["languages", "tr"], tr_label):
            _set_value(data, ["languages", "tr"], tr_label)
            changed_languages += 1
            print(f"[OK] {common_path}: languages.tr → {tr_label}")
        else:
            skipped_languages += 1

        # dialects.tr
        if _needs_write(data, ["dialects", "tr"], tr_label):
            _set_value(data, ["dialects", "tr"], tr_label)
            changed_dialects += 1
            print(f"[OK] {common_path}: dialects.tr → {tr_label}")
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
        f" languages.tr → updated: {changed_languages}, skipped: {skipped_languages};"
        f" dialects.tr → updated: {changed_dialects}, skipped: {skipped_dialects}"
    )


if __name__ == "__main__":
    main()
