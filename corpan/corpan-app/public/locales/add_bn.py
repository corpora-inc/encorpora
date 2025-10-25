#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Add a localized display name for Bengali to languages.bn
in each locales/*/common.json file.

Usage: run from public/locales
    python3 add_bn.py
"""

import json
from pathlib import Path

# Localized names for "Bengali" per locale folder name
LOCALE_TO_BN_NAME = {
    "en": "Bengali",
    "ar": "البنغالية",
    "bn": "বাংলা",
    "de": "Bengalisch",
    "es": "Bengalí",
    "fa": "بنغالی",
    "fr": "Bengali",  # also seen as "bengali" in FR; capitalized here for consistency
    "hi": "बंगाली",
    "hu": "Bengáli",
    "it": "Bengalese",
    "ja": "ベンガル語",
    "ko-polite": "벵골어",
    "pl": "Bengalski",
    "pt-BR": "Bengalês",
    "ru": "Бенгальский",
    "vi": "Tiếng Bengal",
    "zh-Hans": "孟加拉语",
    "zh-Hant": "孟加拉語",
    # If you later add more locales, unknown ones will fall back to "Bengali"
}


def main():
    root = Path(__file__).resolve().parent
    changed = 0
    skipped = 0

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

        # Ensure "languages" object exists
        if "languages" not in data or not isinstance(data["languages"], dict):
            data["languages"] = {}

        # Already has bn?
        if (
            "bn" in data["languages"]
            and isinstance(data["languages"]["bn"], str)
            and data["languages"]["bn"].strip()
        ):
            skipped += 1
            continue

        # Determine localized label
        bn_label = LOCALE_TO_BN_NAME.get(locale_dir.name, "Bengali")
        data["languages"]["bn"] = bn_label

        # Write back with pretty formatting and UTF-8 characters preserved
        try:
            common_path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            changed += 1
            print(f"[OK] Updated {common_path} → languages.bn = {bn_label}")
        except Exception as e:
            print(f"[ERROR] Failed to write {common_path}: {e}")

    print(f"\nDone. Updated: {changed}, skipped (already had bn): {skipped}")


if __name__ == "__main__":
    main()
