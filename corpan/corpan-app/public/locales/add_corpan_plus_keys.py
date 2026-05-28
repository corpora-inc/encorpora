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
        "class": {
            "title": "Who's this for?",
            "subtitle": "We'll tailor Corpán to you. This stays on your device — we never send it anywhere.",
            "learner": "I'm learning languages",
            "learnerDesc": "Read and listen in the languages you're studying.",
            "enjoyer": "I want to enjoy the content",
            "enjoyerDesc": "Books, stories and games in your own language.",
            "polyglot": "Both — I want it all",
            "polyglotDesc": "Several languages at once, plus everything else.",
            "kid": "It's for a kid",
            "kidDesc": "Curated books and learning games for younger readers.",
            "ageTitle": "How old is the reader?",
            "ageUnder13": "Under 13",
            "ageTeen": "13–17",
        },
        "pitch": {
            "title": "Join the Corpanistas",
            "subtitle": "Corpán Plus opens the whole library. Try the first part of any book free, forever.",
            "everything": "Every book, every language — unlocked.",
            "private": "No ads. Your data stays on your device.",
            "team": "We're a small team and put every cent back into Corpán.",
            "tryPlus": "Try Corpán Plus",
            "continueFree": "Continue with the free tier",
        },
    },
    "paywall": {
        "title": "Keep going with Corpán Plus",
        "thanksTitle": "You're a Corpanista",
        "thanksBody": "Thank you for supporting Corpán. Everything is unlocked.",
        "bookSubhead": "You've reached the end of the free preview of {{title}}.",
        "subhead": "Unlock every book in every language. No ads. Your data stays on your device.",
        "pitch": "We're a small team and put every cent back into Corpán. Corpanistas keep it ad-free and growing.",
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
