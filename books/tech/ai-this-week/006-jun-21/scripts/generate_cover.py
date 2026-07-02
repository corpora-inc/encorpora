#!/usr/bin/env python3
"""Generate ep6 cover.jpg via OpenAI gpt-image-1.

Painterly editorial style continuous with eps 3-5. Theme for ep6:
'Megawatts and Market Caps' — macro/political/structural. A vast
plain of high-voltage transmission towers marching toward a distant
data center complex glowing on the horizon at dawn, with faint
financial ledger pages and stock-ticker numerals drifting in the
air between the towers like dust motes.

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
           "/home/skyl/encorpora/books/tech/ai-this-week/006-jun-21/cover.jpg")

PROMPT = (
    "Painterly editorial illustration of a vast open plain at dawn, "
    "seen from low to the ground. Across the plain, a long receding "
    "procession of high-voltage transmission towers — steel lattice, "
    "endless cables — marches toward the horizon. On the far horizon, "
    "a low cluster of warehouse-style data center buildings glows with "
    "a steady cold-white interior light, fed by the converging power "
    "lines. In the foreground a single concrete transformer pad with "
    "ceramic insulators catches the first warm light of sunrise. "
    "Floating gently in the air between the towers, like dust motes "
    "or pollen, are faint translucent fragments of financial ledger "
    "pages and stock-ticker numerals — not legible as specific text, "
    "just the suggestion of columns, percentages, and dollar amounts "
    "drifting on the wind. The mood is industrial-political, structural, "
    "quietly enormous. Restrained palette: deep cobalt and slate-blue "
    "for the towers and pre-dawn sky, ledger-green and pale-paper for "
    "the drifting numerals, a single warm amber band on the eastern "
    "horizon. Painterly digital illustration, low saturation, very "
    "high craftsmanship, no photorealism. No text, no logos, no "
    "watermarks, no captions, no UI elements, no human figures. "
    "Square composition."
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
