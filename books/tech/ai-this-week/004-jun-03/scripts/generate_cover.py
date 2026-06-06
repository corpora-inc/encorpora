#!/usr/bin/env python3
"""Generate ep4 cover.jpg via OpenAI gpt-image-1.

Matches the painterly editorial style of ep3 (the moonlit laptop with
globe + threads). Theme for ep4: 'Frontier on the Countertop' — a
small powerful AI box glowing on a counter, dwarfing a faded
data-center silhouette behind it.

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
           "/home/skyl/encorpora/books/tech/ai-this-week/004-jun-03/cover.jpg")

PROMPT = (
    "Painterly editorial illustration of a small, sleek aluminum-bodied "
    "AI mini-computer sitting on a kitchen countertop in a quiet "
    "domestic interior at evening. The little machine glows with a warm "
    "amber light from its front face, almost like a hearth. Faint warm "
    "threads of light rise from it. In the soft-focus background, "
    "barely visible through a window, the cold blue silhouette of a "
    "vast distant industrial data center — towers, cooling stacks, "
    "transmission lines — appears dimmed and out of focus, dwarfed by "
    "the small glowing box in the foreground. A wooden cutting board "
    "and a steaming mug rest beside the mini-computer. Curtains, soft "
    "shadows, the warm intimacy of a kitchen at the end of the day. "
    "Restrained palette: deep indigo and ember amber, the contrast of "
    "warm-domestic against cold-industrial. Painterly digital "
    "illustration, low saturation, very high craftsmanship, no "
    "photorealism. No text, no logos, no watermarks, no captions, no "
    "UI elements. Square composition."
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
