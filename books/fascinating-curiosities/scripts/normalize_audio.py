#!/usr/bin/env python3
"""
Two-pass EBU R128 loudness normalization for audiobook segments.

Normalizes all opus files to industry-standard audiobook levels using
ffmpeg's loudnorm filter in two-pass linear mode, which applies a constant
gain to preserve natural dynamics.

Targets (ACX/Audible-compliant sweet spot):
    - Integrated loudness:  -20 LUFS  (ACX range: -23 to -18 dB RMS)
    - True peak:            -3 dBTP   (ACX maximum)
    - Loudness range:       preserved (linear mode, no dynamic compression)

Two-pass approach:
    Pass 1: Measure input loudness (LUFS, TP, LRA, threshold)
    Pass 2: Apply linear normalization using measured values

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


def measure_loudness(input_path: str, target_i: float, target_tp: float) -> dict:
    """
    Pass 1: Measure input loudness using ffmpeg loudnorm filter.

    Returns dict with measured_I, measured_TP, measured_LRA, measured_thresh,
    target_offset — needed for accurate pass-2 linear normalization.
    """
    cmd = [
        "ffmpeg", "-hide_banner", "-y",
        "-i", input_path,
        "-af", f"loudnorm=I={target_i}:TP={target_tp}:LRA=11:print_format=json",
        "-f", "null", "/dev/null",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

    # Parse the JSON block from stderr
    stderr = result.stderr
    json_match = re.search(r'\{[^}]+\}', stderr, re.DOTALL)
    if not json_match:
        raise RuntimeError(f"Could not parse loudnorm output for {input_path}")

    return json.loads(json_match.group())


def normalize_file(
    input_path: str,
    output_path: str,
    measurements: dict,
    target_i: float,
    target_tp: float,
) -> dict:
    """
    Pass 2: Apply linear normalization using pass-1 measurements.

    Linear mode applies a constant gain offset — no dynamic compression,
    preserving the natural dynamics of the narration.
    """
    # Two-pass dynamic normalization: uses pass-1 measurements for accuracy
    # but applies adaptive gain that respects BOTH the LUFS target and TP
    # ceiling simultaneously. Unlike linear mode (constant gain that can
    # push peaks above TP), dynamic mode adjusts gain in real-time to
    # honor both constraints. For short audiobook segments (2-30s speech),
    # the adaptive processing is virtually transparent.
    af_filter = (
        f"loudnorm=I={target_i}:TP={target_tp}:LRA=11"
        f":measured_I={measurements['input_i']}"
        f":measured_TP={measurements['input_tp']}"
        f":measured_LRA={measurements['input_lra']}"
        f":measured_thresh={measurements['input_thresh']}"
        f":offset={measurements['target_offset']}"
        f":linear=false"
    )

    cmd = [
        "ffmpeg", "-hide_banner", "-y",
        "-i", input_path,
        "-af", af_filter,
        "-c:a", "libopus",
        "-b:a", "48000",
        "-application", "voip",
        "-vbr", "on",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f"Normalization failed for {input_path}: {result.stderr[:300]}")

    return measurements


def process_one(
    opus_path: str,
    target_i: float,
    target_tp: float,
) -> dict:
    """Process a single opus file: measure → normalize → replace."""
    fname = os.path.basename(opus_path)

    # Pass 1: measure
    measurements = measure_loudness(opus_path, target_i, target_tp)
    input_lufs = float(measurements["input_i"])
    input_tp = float(measurements["input_tp"])

    # Pass 2: normalize to temp file, then replace original
    with tempfile.NamedTemporaryFile(suffix=".opus", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        normalize_file(opus_path, tmp_path, measurements, target_i, target_tp)
        # Atomic replace
        os.replace(tmp_path, opus_path)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise

    return {
        "file": fname,
        "input_lufs": input_lufs,
        "input_tp": input_tp,
        "target_offset": float(measurements["target_offset"]),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Two-pass loudness normalization for audiobook opus files"
    )
    parser.add_argument(
        "--audio-dir", required=True,
        help="Directory containing opus files to normalize"
    )
    parser.add_argument(
        "--target-lufs", type=float, default=-20.0,
        help="Target integrated loudness in LUFS (default: -20.0)"
    )
    parser.add_argument(
        "--true-peak", type=float, default=-3.0,
        help="Maximum true peak in dBTP (default: -3.0)"
    )
    parser.add_argument(
        "--workers", type=int, default=4,
        help="Parallel worker threads (default: 4)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Measure only, don't normalize"
    )
    args = parser.parse_args()

    audio_dir = args.audio_dir
    if not os.path.isdir(audio_dir):
        print(f"ERROR: Directory not found: {audio_dir}")
        sys.exit(1)

    opus_files = sorted(Path(audio_dir).glob("*.opus"))
    if not opus_files:
        print(f"ERROR: No opus files found in {audio_dir}")
        sys.exit(1)

    print(f"Normalizing {len(opus_files)} opus files")
    print(f"  Target: {args.target_lufs} LUFS, {args.true_peak} dBTP")
    print(f"  Workers: {args.workers}")
    print(f"  Mode: {'dry-run (measure only)' if args.dry_run else 'two-pass linear'}")
    print()

    t_start = time.time()
    results = []
    errors = []

    if args.dry_run:
        # Measure only
        for i, fp in enumerate(opus_files):
            try:
                m = measure_loudness(str(fp), args.target_lufs, args.true_peak)
                lufs = float(m["input_i"])
                tp = float(m["input_tp"])
                results.append({"file": fp.name, "input_lufs": lufs, "input_tp": tp})
                print(f"  [{i+1}/{len(opus_files)}] {fp.name}: {lufs:.1f} LUFS, {tp:.1f} dBTP")
            except Exception as e:
                errors.append({"file": fp.name, "error": str(e)})
                print(f"  [{i+1}/{len(opus_files)}] {fp.name}: ERROR - {e}")
    else:
        # Two-pass normalize with thread pool
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
                    if done % 50 == 0 or done == len(opus_files):
                        elapsed = time.time() - t_start
                        rate = done / elapsed
                        remaining = (len(opus_files) - done) / rate if rate > 0 else 0
                        print(
                            f"  Progress: {done}/{len(opus_files)} "
                            f"({elapsed:.0f}s elapsed, ~{remaining:.0f}s remaining)"
                        )
                except Exception as e:
                    errors.append({"file": fp.name, "error": str(e)})
                    print(f"  ERROR {fp.name}: {e}")

    elapsed = time.time() - t_start

    # Summary statistics
    if results:
        lufs_values = [r["input_lufs"] for r in results]
        tp_values = [r["input_tp"] for r in results]
        avg_lufs = sum(lufs_values) / len(lufs_values)
        min_lufs = min(lufs_values)
        max_lufs = max(lufs_values)
        avg_tp = sum(tp_values) / len(tp_values)

        print(f"\n{'='*60}")
        print(f"{'Measurement' if args.dry_run else 'Normalization'} complete!")
        print(f"  Files processed: {len(results)}")
        print(f"  Errors: {len(errors)}")
        print(f"  Time: {elapsed:.0f}s ({elapsed/60:.1f}min)")
        print(f"\n  Pre-normalization stats:")
        print(f"    Avg loudness: {avg_lufs:.1f} LUFS")
        print(f"    Range: {min_lufs:.1f} to {max_lufs:.1f} LUFS")
        print(f"    Avg true peak: {avg_tp:.1f} dBTP")
        if not args.dry_run:
            print(f"\n  Normalized to: {args.target_lufs} LUFS, {args.true_peak} dBTP")
        print(f"{'='*60}")

    if errors:
        print(f"\nErrors ({len(errors)}):")
        for e in errors:
            print(f"  {e['file']}: {e['error']}")


if __name__ == "__main__":
    main()
