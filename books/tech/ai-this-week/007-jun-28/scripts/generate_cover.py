#!/usr/bin/env python3
"""Generate ep7 cover.jpg via OpenAI gpt-image-1.

Painterly editorial style continuous with eps 3-6. Theme for ep7:
'The Student and the Score' — knowledge distillation (a large luminous
teacher-form pouring light into a smaller student-form that glows with
borrowed light) and benchmark integrity (faint, unstable scoreboard
numerals drifting and dissolving in the air). No human figures.

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
           "/home/skyl/encorpora/books/tech/ai-this-week/007-jun-28/cover.jpg")

PROMPT = (
    "Painterly editorial illustration, square composition, seen against "
    "a deep pre-dawn sky. On the left, a large luminous translucent "
    "sphere of softly woven light — the 'teacher' — radiating countless "
    "fine golden threads. The threads converge and pour rightward into a "
    "much smaller identical sphere — the 'student' — that glows with a "
    "paler, borrowed version of the same light, clearly a copy at a "
    "fraction of the size. Drifting in the air all around them, like "
    "dust motes or pollen, are faint translucent fragments of "
    "scoreboards, ranking columns, and percentage numerals — some "
    "crisp, many dissolving or half-erased, suggesting the numbers are "
    "unstable and not quite trustworthy. The mood is contemplative, "
    "technical, quietly tense. Restrained palette: deep cobalt and "
    "slate-blue for the sky and drifting numerals, warm amber and gold "
    "for the teacher's light, pale silver for the student's borrowed "
    "glow. Painterly digital illustration, low saturation, very high "
    "craftsmanship, no photorealism. No text, no logos, no watermarks, "
    "no captions, no UI elements, no human figures. Square composition."
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
