#!/usr/bin/env python3
"""Seed the canonical English keys for Corpán Plus (paywall + new onboarding).

These strings already render via inline defaultValue in the components, so the
feature works in English without this. This seeds en/common.json as the
source for the cross-language fanout (run the Vertex translate pipeline next,
same pattern as add_catalog_paywall_translations.py).

Idempotent: only fills missing keys.
"""
import json
from pathlib import Path

EN = Path(__file__).parent / "en" / "common.json"

NEW = {
    "onboarding": {
        "back": "Back",
        "continue": "Continue",
    },
    "paywall": {
        "title": "Unlock Corpán Plus",
        "thanksTitle": "Corpán Plus is active",
        "thanksBody": "Everything is unlocked.",
        "bookSubhead": "Continue {{title}} and unlock every feature.",
        "subhead": "Unlimited access to every feature, language, and update. No ads. Your data stays on your device.",
        "pitch": "Books, packs, games, speech tools, and new learning experiences are all included.",
        "maybeLater": "Maybe later",
        "continue": "Continue",
    },
    "packs": {
        "unlockWithPlus": "Unlock with Corpán Plus",
        "plus": "Corpán Plus",
        "includedWithPlus": "Included with Plus",
    },
    "streak": {
        "title": "{{count}}-day streak",
    },
}


def merge(dst: dict, src: dict) -> None:
    for k, v in src.items():
        if isinstance(v, dict):
            dst.setdefault(k, {})
            merge(dst[k], v)
        else:
            dst.setdefault(k, v)


def main() -> None:
    data = json.loads(EN.read_text())
    merge(data, NEW)
    EN.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(f"Seeded Corpán Plus keys into {EN}")


if __name__ == "__main__":
    main()
