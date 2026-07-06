#!/usr/bin/env python3
"""Batch generator for imagepan concept cards (runs ON THE SPARK).

Loads the SD3.5-Large pipeline ONCE, then loops a concept list, writing one PNG
per concept + a JSON reproducibility sidecar (prompt/seed/model/style_id). This
is the batch skeleton the full ~2,300-concept run scales from; the single-prompt
scripts/generate.py reloads the 8-9 GB model every call and is unusable at batch
scale.

Model licensing: SD3.5-Large Stability Community License — outputs are owned,
commercial use OK under $1M revenue. FLUX.1-dev is BANNED for shipped assets.

Usage (on spark-f62c, from ~/projects/image-gen with its .venv active):
    python gen_batch.py CONCEPTS.json --out OUT_DIR [--num 1] [--steps 28]

Copy style.py + the concepts json next to this file before running.
"""
from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import torch
from diffusers import StableDiffusion3Pipeline

from style import STYLE_ID, NEGATIVE_PROMPT, build_prompt

MODEL_ID = "stabilityai/stable-diffusion-3.5-large"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("concepts", type=Path, help="JSON list of {id, subject, seed, ...}")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--num", type=int, default=1, help="candidates per concept")
    ap.add_argument("--width", type=int, default=1024)
    ap.add_argument("--height", type=int, default=1024)
    ap.add_argument("--steps", type=int, default=28)
    ap.add_argument("--guidance-scale", type=float, default=4.5)
    args = ap.parse_args()

    concepts = json.loads(args.concepts.read_text(encoding="utf-8"))
    args.out.mkdir(parents=True, exist_ok=True)

    print(f"Loading {MODEL_ID} ...")
    pipe = StableDiffusion3Pipeline.from_pretrained(MODEL_ID, torch_dtype=torch.float16)
    pipe.to("cuda")
    pipe.vae.enable_tiling()
    print("Model loaded.")

    t_all = time.time()
    for c in concepts:
        prompt = build_prompt(c["subject"], c.get("extra", ""))
        base_seed = int(c.get("seed", 0))
        for i in range(args.num):
            seed = base_seed + i
            gen = torch.Generator(device="cuda").manual_seed(seed)
            t0 = time.time()
            img = pipe(
                prompt=prompt,
                negative_prompt=NEGATIVE_PROMPT,
                width=args.width,
                height=args.height,
                num_inference_steps=args.steps,
                guidance_scale=args.guidance_scale,
                generator=gen,
            ).images[0]
            elapsed = time.time() - t0
            suffix = f"_{i}" if args.num > 1 else ""
            stem = f"{c['id']}{suffix}"
            png = args.out / f"{stem}.png"
            img.save(png)
            png.with_suffix(".json").write_text(json.dumps({
                "concept_id": c["id"],
                "en_lemma": c.get("en_lemma"),
                "subject": c["subject"],
                "prompt": prompt,
                "negative_prompt": NEGATIVE_PROMPT,
                "style_id": STYLE_ID,
                "seed": seed,
                "model": MODEL_ID,
                "steps": args.steps,
                "guidance_scale": args.guidance_scale,
                "width": args.width,
                "height": args.height,
                "generation_time_s": round(elapsed, 2),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }, indent=2))
            print(f"  {stem}.png ({elapsed:.1f}s)")

    print(f"Done. {len(concepts)} concepts in {time.time() - t_all:.0f}s -> {args.out}")


if __name__ == "__main__":
    main()
