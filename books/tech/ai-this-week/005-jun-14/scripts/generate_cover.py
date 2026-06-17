#!/usr/bin/env python3
"""Generate ep5 cover.jpg via OpenAI gpt-image-1.

Painterly editorial style continuous with eps 3 & 4. Theme for ep5:
'Sundays, and Who We Are' — a small Sunday-morning workshop/studio
window, warm light spilling out across many faint multilingual
threads going out into the world, with the cold towers of big-co AI
dimmed and tiny in the distance.

Usage:
    OPENAI_API_KEY=... python3 generate_cover.py [out_path]
"""
from __future__ import annotations

import base64
import os
import sys
from pathlib import Path

from openai import OpenAI

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else
           "/home/skyl/encorpora/books/tech/ai-this-week/005-jun-14/cover.jpg")

PROMPT = (
    "Painterly editorial illustration of a small wooden Sunday-morning "
    "workshop or studio on a quiet hilltop, seen from outside at dawn. "
    "A single warm honey-amber light spills from the workshop window, "
    "and from that window many faint glowing threads of warm light "
    "fan out across the foggy landscape toward the horizon — each "
    "thread carrying a soft floating fragment of multilingual writing, "
    "different scripts barely visible (Devanagari, Arabic, Han, "
    "Cyrillic, Greek, Hebrew, Thai, Tamil), like sound made into light. "
    "The threads disappear into a soft golden haze on the horizon. "
    "Far in the background, dimmed and small, the cold blue silhouettes "
    "of distant industrial data-center towers and transmission lines — "
    "dwarfed by the warmth of the little workshop in the foreground. A "
    "steaming mug rests on the workshop's outer ledge. Sunday-quiet, "
    "intimate, lived-in. Restrained palette: warm honey amber and "
    "rose-gold for the foreground, deep periwinkle dawn sky, faded "
    "slate-blue for the distant industrial silhouettes. Painterly "
    "digital illustration, low saturation, very high craftsmanship, "
    "no photorealism. No text, no logos, no watermarks, no captions, "
    "no UI elements. Square composition."
)


def main() -> None:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        # Try .env
        env = Path(__file__).resolve().parents[4] / ".env"
        if env.exists():
            for line in env.read_text().splitlines():
                if line.startswith("OPENAI_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    if not key:
        print("ERROR: OPENAI_API_KEY not set and not found in .env", file=sys.stderr)
        sys.exit(1)

    client = OpenAI(api_key=key)
    print(f"Generating cover via gpt-image-1 → {OUT}")
    resp = client.images.generate(
        model="gpt-image-1",
        prompt=PROMPT,
        size="1024x1024",
        quality="high",
        n=1,
    )
    b64 = resp.data[0].b64_json
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(base64.b64decode(b64))
    print(f"Wrote {OUT} ({OUT.stat().st_size/1024:.1f} KB)")


if __name__ == "__main__":
    main()
