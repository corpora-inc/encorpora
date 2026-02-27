#!/usr/bin/env python3
"""
Audio mastering for existing audiobook opus segments.

Applies a mastering-grade filter chain to clean up TTS artifacts:
    1. highpass  — remove sub-80Hz rumble/DC offset
    2. adeclick  — interpolate over pops/clicks
    3. afftdn    — FFT spectral denoising (gentle, adaptive)
    4. agate     — noise gate for clean silences
    5. acompressor — gentle 2:1 compression to even out levels
    6. alimiter  — true peak safety limiter at -3 dBTP

Run this BEFORE normalize_audio.py (mastering may change levels).

Usage:
    python master_audio.py \
        --audio-dir ../01-mystery-of-monte-alban/pack/audio/en \
        --workers 4
"""

import argparse
import os
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


def build_mastering_chain() -> str:
    """Build the ffmpeg audio filter chain for mastering TTS output."""
    return ",".join([
        "highpass=f=80:width_type=q:width=0.7",
        "adeclick=window=55:overlap=75:threshold=2",
        "afftdn=nr=12:nf=-40:tn=1",
        "agate=threshold=0.018:range=0.01:attack=5:release=50",
        "acompressor=threshold=0.1:ratio=2:attack=10:release=100:makeup=1",
        "alimiter=limit=0.708:level=false",
    ])


def process_one(opus_path: str) -> dict:
    """Decode, apply mastering chain, re-encode, atomic replace."""
    fname = os.path.basename(opus_path)

    with tempfile.NamedTemporaryFile(suffix=".opus", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        cmd = [
            "ffmpeg", "-hide_banner", "-y",
            "-i", opus_path,
            "-af", build_mastering_chain(),
            "-c:a", "libopus",
            "-b:a", "48000",
            "-application", "voip",
            "-vbr", "on",
            tmp_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise RuntimeError(f"Mastering failed: {result.stderr[:300]}")
        os.replace(tmp_path, opus_path)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise

    return {"file": fname, "status": "ok"}


def main():
    parser = argparse.ArgumentParser(
        description="Master existing opus audiobook files (denoise, declick, compress)"
    )
    parser.add_argument("--audio-dir", required=True,
                        help="Directory containing opus files")
    parser.add_argument("--workers", type=int, default=4,
                        help="Parallel workers (default: 4)")
    args = parser.parse_args()

    opus_files = sorted(Path(args.audio_dir).glob("*.opus"))
    if not opus_files:
        print(f"ERROR: No opus files in {args.audio_dir}")
        sys.exit(1)

    print(f"Mastering {len(opus_files)} opus files")
    print(f"  Chain: highpass → adeclick → afftdn → agate → acompressor → alimiter")
    print(f"  Workers: {args.workers}")
    print()

    t_start = time.time()
    results = []
    errors = []

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(process_one, str(fp)): fp
            for fp in opus_files
        }
        done = 0
        for future in as_completed(futures):
            done += 1
            fp = futures[future]
            try:
                r = future.result()
                results.append(r)
                if done % 100 == 0 or done == len(opus_files):
                    elapsed = time.time() - t_start
                    rate = done / elapsed if elapsed > 0 else 1
                    remaining = (len(opus_files) - done) / rate
                    print(f"  Progress: {done}/{len(opus_files)} "
                          f"({elapsed:.0f}s, ~{remaining:.0f}s left)")
            except Exception as e:
                errors.append({"file": fp.name, "error": str(e)})
                print(f"  ERROR {fp.name}: {e}")

    elapsed = time.time() - t_start
    print(f"\n{'='*60}")
    print(f"Mastering complete!")
    print(f"  Files: {len(results)} processed, {len(errors)} errors")
    print(f"  Time: {elapsed:.0f}s ({elapsed/60:.1f}min)")
    print(f"{'='*60}")

    if errors:
        print(f"\nErrors ({len(errors)}):")
        for e in errors:
            print(f"  {e['file']}: {e['error']}")


if __name__ == "__main__":
    main()
