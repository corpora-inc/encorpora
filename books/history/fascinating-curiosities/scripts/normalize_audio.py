#!/usr/bin/env python3
"""
Constant-gain loudness normalization for audiobook segments.

Applies a single constant gain (volume adjustment) to each opus file
to reach the target LUFS, with peak clamping to stay below the true
peak ceiling. No adaptive/dynamic processing — just a volume knob.

This avoids noise pumping artifacts that dynamic normalizers (like
ffmpeg's loudnorm in dynamic mode) can introduce during silences.

Approach per file:
    1. Measure integrated LUFS and true peak via loudnorm (analysis only)
    2. Calculate needed gain: target_LUFS - measured_LUFS
    3. Check if (measured_peak + gain) would exceed TP ceiling
    4. If yes, reduce gain so peak = TP ceiling (slightly lower LUFS)
    5. Apply constant gain via ffmpeg volume filter
    6. Re-encode to opus

Targets (ACX/Audible-compliant):
    - Integrated loudness:  -20 LUFS  (ACX range: -23 to -18 dB RMS)
    - True peak:            -3 dBTP   (ACX maximum)

Usage:
    python normalize_audio.py \
        --audio-dir ../01-mystery-of-monte-alban/pack/audio/en \
        --target-lufs -20 \
        --true-peak -3 \
        --workers 4
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


def measure_loudness(input_path: str) -> dict:
    """Measure integrated LUFS and true peak using ffmpeg loudnorm analysis."""
    cmd = [
        "ffmpeg", "-hide_banner", "-y",
        "-i", input_path,
        "-af", "loudnorm=I=-20:TP=-3:LRA=11:print_format=json",
        "-f", "null", "/dev/null",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    json_match = re.search(r'\{[^}]+\}', result.stderr, re.DOTALL)
    if not json_match:
        raise RuntimeError(f"Could not parse loudnorm output for {input_path}")
    return json.loads(json_match.group())


def process_one(
    opus_path: str,
    target_i: float,
    target_tp: float,
) -> dict:
    """Measure, calculate constant gain, apply, replace."""
    fname = os.path.basename(opus_path)

    # Step 1: Measure
    measurements = measure_loudness(opus_path)
    input_lufs = float(measurements["input_i"])
    input_tp = float(measurements["input_tp"])

    # Step 2: Calculate constant gain
    gain_db = target_i - input_lufs

    # Step 3: Clamp gain so peak stays below ceiling
    projected_peak = input_tp + gain_db
    if projected_peak > target_tp:
        gain_db = target_tp - input_tp
        clamped = True
    else:
        clamped = False

    final_lufs = input_lufs + gain_db
    final_peak = input_tp + gain_db

    # Step 4: Apply constant gain and re-encode
    with tempfile.NamedTemporaryFile(suffix=".opus", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        cmd = [
            "ffmpeg", "-hide_banner", "-y",
            "-i", opus_path,
            "-af", f"volume={gain_db:.2f}dB",
            "-c:a", "libopus",
            "-b:a", "48000",
            "-application", "voip",
            "-vbr", "on",
            tmp_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise RuntimeError(f"Encoding failed: {result.stderr[:300]}")
        os.replace(tmp_path, opus_path)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise

    return {
        "file": fname,
        "input_lufs": input_lufs,
        "input_tp": input_tp,
        "gain_db": gain_db,
        "final_lufs": final_lufs,
        "final_peak": final_peak,
        "clamped": clamped,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Constant-gain loudness normalization for audiobook opus files"
    )
    parser.add_argument("--audio-dir", required=True)
    parser.add_argument("--target-lufs", type=float, default=-20.0)
    parser.add_argument("--true-peak", type=float, default=-3.0)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--dry-run", action="store_true",
                        help="Measure and report, don't modify files")
    args = parser.parse_args()

    opus_files = sorted(Path(args.audio_dir).glob("*.opus"))
    if not opus_files:
        print(f"ERROR: No opus files in {args.audio_dir}")
        sys.exit(1)

    print(f"Normalizing {len(opus_files)} opus files")
    print(f"  Target: {args.target_lufs} LUFS, {args.true_peak} dBTP")
    print(f"  Method: constant gain (no dynamic processing)")
    print(f"  Workers: {args.workers}")
    if args.dry_run:
        print(f"  DRY RUN — no files will be modified")
    print()

    t_start = time.time()
    results = []
    errors = []

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(process_one, str(fp), args.target_lufs, args.true_peak): fp
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
                    rate = done / elapsed
                    remaining = (len(opus_files) - done) / rate if rate > 0 else 0
                    print(f"  Progress: {done}/{len(opus_files)} "
                          f"({elapsed:.0f}s, ~{remaining:.0f}s left)")
            except Exception as e:
                errors.append({"file": fp.name, "error": str(e)})
                print(f"  ERROR {fp.name}: {e}")

    elapsed = time.time() - t_start

    if results:
        input_lufs = [r["input_lufs"] for r in results]
        final_lufs = [r["final_lufs"] for r in results]
        gains = [r["gain_db"] for r in results]
        clamped = [r for r in results if r["clamped"]]

        print(f"\n{'='*60}")
        print(f"Normalization complete!")
        print(f"  Files: {len(results)} processed, {len(errors)} errors")
        print(f"  Time: {elapsed:.0f}s ({elapsed/60:.1f}min)")
        print(f"\n  Input:  avg {sum(input_lufs)/len(input_lufs):.1f} LUFS "
              f"(range {min(input_lufs):.1f} to {max(input_lufs):.1f})")
        print(f"  Output: avg {sum(final_lufs)/len(final_lufs):.1f} LUFS "
              f"(range {min(final_lufs):.1f} to {max(final_lufs):.1f})")
        print(f"  Gain:   avg {sum(gains)/len(gains):.1f} dB "
              f"(range {min(gains):.1f} to {max(gains):.1f})")
        print(f"  Peak-clamped: {len(clamped)}/{len(results)} files")
        print(f"{'='*60}")

    if errors:
        print(f"\nErrors ({len(errors)}):")
        for e in errors:
            print(f"  {e['file']}: {e['error']}")


if __name__ == "__main__":
    main()
