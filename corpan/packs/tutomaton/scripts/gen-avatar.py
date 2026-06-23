#!/usr/bin/env python3
"""
Generate Tutomaton avatar candidates via gpt-image-1.

Brand brief (per Skylar): understated, elegant, simple line work, ~one accent
color. A sibling to the Parlometron / Corpán marks — NOT AI slop, no busy
sci-fi robot. "Tutomaton" = a patient tutor + automaton: a calm, friendly
language-tutor presence rendered with restraint.

Reads OPENAI_API_KEY from the repo-root .env (or the environment).
Writes candidates to corpan/packs/tutomaton/artwork-candidates/cN.png.
Pick one, then copy it to corpan/packs/tutomaton/tutomaton-avatar.png.

    cd corpan/packs/tutomaton && python3 scripts/gen-avatar.py
"""
import base64
import os
import sys
import time
from pathlib import Path

import openai

PACK_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PACK_ROOT.parents[2]  # encorpora/
OUT_DIR = PACK_ROOT / "artwork-candidates"

# Mirror corpan/infra/generate-catalog-assets.py house style tail.
COMMON_TAIL = (
    "Editorial illustration, minimal line art, high craftsmanship, deliberate "
    "composition, restrained palette, generous negative space, flat clean "
    "background, no text, no logos, no watermarks, no photorealism. Centered "
    "square composition."
)

# Each candidate leans on a single accent color and simple linework, but tries a
# slightly different metaphor so there's a real choice.
CANDIDATES = [
    (
        "c1-owl-teal",
        "A calm, friendly tutor-automaton imagined as a softly geometric owl "
        "(owl = patient teacher), drawn as clean continuous single-weight line "
        "art in one teal accent color on a near-white background. Gentle, wise, "
        "approachable; subtle hint of a mechanical/automaton facet without "
        "looking like a busy robot. " + COMMON_TAIL
    ),
    (
        "c2-speechbubble-indigo",
        "A minimal mark combining a speech bubble and a gentle automaton face "
        "(two dot eyes, a calm curve smile) as a single tutor-companion glyph, "
        "clean single-weight line art in one indigo accent color on a near-white "
        "background. Understated, conversational, patient. " + COMMON_TAIL
    ),
    (
        "c3-head-amber",
        "A serene tutor-automaton head in three-quarter view, drawn with simple "
        "elegant linework in one warm amber accent color on a near-white "
        "background; a single small spark/idea dot near the temple to suggest "
        "learning. Quiet, kind, human-warm machine. " + COMMON_TAIL
    ),
    (
        "c4-abstract-sage",
        "An abstract, understated emblem for a language tutor: two simple line "
        "forms in conversation (a listening curve and a speaking curve) resolving "
        "into a calm face, single-weight line art in one sage-green accent color "
        "on a near-white background. Elegant, restrained, timeless. " + COMMON_TAIL
    ),
]


def load_env_key() -> None:
    if os.environ.get("OPENAI_API_KEY"):
        return
    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        sys.exit(f"OPENAI_API_KEY not set and {env_path} not found")
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line.startswith("OPENAI_API_KEY"):
            _, _, val = line.partition("=")
            os.environ["OPENAI_API_KEY"] = val.strip().strip('"').strip("'")
            return
    sys.exit(f"OPENAI_API_KEY line not found in {env_path}")


def main() -> None:
    load_env_key()
    client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for name, prompt in CANDIDATES:
        if only and only not in name:
            continue
        out = OUT_DIR / f"{name}.png"
        print(f"[avatar] {name} → generating…", flush=True)
        t0 = time.time()
        resp = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            size="1024x1024",
            quality="high",
            n=1,
        )
        b64 = resp.data[0].b64_json
        if not b64:
            raise RuntimeError("OpenAI returned no image data")
        out.write_bytes(base64.b64decode(b64))
        print(f"[avatar] {name} ← {time.time() - t0:.1f}s  {out}", flush=True)
    print(f"\n[avatar] done. Review {OUT_DIR}/ and copy your pick to "
          f"{PACK_ROOT / 'tutomaton-avatar.png'}")


if __name__ == "__main__":
    main()
