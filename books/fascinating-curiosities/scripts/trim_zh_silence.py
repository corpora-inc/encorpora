#!/usr/bin/env python3
"""
Trim excessive trailing silence from Chinese TTS audio segments.

Uses alignment data to find where the last word ends, then trims WAVs
to last_word_end + 500ms with a 50ms fade-out. Re-masters trimmed WAVs
to M4A and updates the audio manifest.

Only trims segments with >5000ms trailing silence (conservative threshold).
Internal gaps at sentence boundaries are left untouched.

Usage:
    python trim_zh_silence.py                # dry-run (default)
    python trim_zh_silence.py --apply        # actually trim + re-master
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

# ---------------------------------------------------------------------------
# Paths (match generate_audio_all.py layout)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
BOOK_DIR = SCRIPT_DIR.parent / "01-mystery-of-monte-alban"
PACK_DIR = BOOK_DIR / "pack"

ALIGNMENT_PATH = PACK_DIR / "alignment_zh.json"
MANIFEST_PATH = PACK_DIR / "audio_manifest_zh.json"
WAV_DIR = PACK_DIR / "audio" / "zh" / "wav"
M4A_DIR = PACK_DIR / "audio" / "zh"

# ---------------------------------------------------------------------------
# Mastering constants (same as generate_audio_all.py)
# ---------------------------------------------------------------------------
TARGET_LUFS = -20.0
TARGET_TP = -3.0  # dBTP

# Trim parameters
TAIL_MS = 500       # keep 500ms after last word
FADE_MS = 50        # fade-out duration
THRESHOLD_MS = 5000  # only trim if trailing silence > 5s


def load_json(path: Path) -> dict | None:
    if path.exists():
        with open(path, "r") as f:
            return json.load(f)
    return None


def save_json_atomic(data: dict, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)


def measure_loudness(wav_path: str) -> dict:
    """Measure LUFS via ffmpeg loudnorm filter (analysis pass)."""
    cmd = [
        "ffmpeg", "-hide_banner", "-i", wav_path,
        "-af", "loudnorm=print_format=json",
        "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    import re
    json_match = re.search(r"\{[^}]+\}", result.stderr, re.DOTALL)
    if not json_match:
        raise RuntimeError(f"Could not parse loudnorm output for {wav_path}")
    return json.loads(json_match.group())


def master_one_segment(wav_path: str, m4a_path: str,
                       target_i: float, target_tp: float) -> dict:
    """Measure LUFS on WAV, then apply gain + mastering + m4a encode."""
    measurements = measure_loudness(wav_path)
    input_lufs = float(measurements["input_i"])
    input_tp = float(measurements["input_tp"])

    gain_db = target_i - input_lufs
    projected_peak = input_tp + gain_db
    clamped = False
    if projected_peak > target_tp:
        gain_db = target_tp - input_tp
        clamped = True

    af_chain = ",".join([
        f"volume={gain_db:.2f}dB",
        "highpass=f=80:width_type=q:width=0.7",
        "adeclick=window=55:overlap=75:threshold=1.5",
        "afftdn=nr=15:nf=-35:tn=1",
        "agate=threshold=0.018:range=0.01:attack=5:release=50",
        "acompressor=threshold=0.1:ratio=2:attack=10:release=100:makeup=1",
        "alimiter=limit=0.708:level=false",
    ])

    os.makedirs(os.path.dirname(m4a_path), exist_ok=True)

    cmd = [
        "ffmpeg", "-y", "-i", wav_path,
        "-af", af_chain,
        "-c:a", "aac",
        "-b:a", "64000",
        m4a_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg encoding failed for {wav_path}: {result.stderr[:300]}"
        )

    return {
        "input_lufs": input_lufs,
        "input_tp": input_tp,
        "gain_db": gain_db,
        "clamped": clamped,
    }


def main():
    apply = "--apply" in sys.argv

    alignment = load_json(ALIGNMENT_PATH)
    manifest = load_json(MANIFEST_PATH)
    if not alignment or not manifest:
        print("ERROR: Missing alignment_zh.json or audio_manifest_zh.json")
        sys.exit(1)

    segments = manifest["segments"]
    trimmed = 0
    skipped = 0
    errors = 0
    total_saved_ms = 0

    candidates = []

    for seg_id, align_data in alignment.items():
        if seg_id not in segments:
            continue

        words = align_data.get("words", [])
        if not words:
            continue

        last_word_end_ms = max(w["end_ms"] for w in words)
        current_duration_ms = segments[seg_id]["duration_ms"]
        trailing_ms = current_duration_ms - last_word_end_ms

        if trailing_ms > THRESHOLD_MS:
            candidates.append((seg_id, last_word_end_ms, current_duration_ms, trailing_ms))

    # Sort by trailing silence descending for reporting
    candidates.sort(key=lambda x: -x[3])

    print(f"Found {len(candidates)} segments with >{THRESHOLD_MS}ms trailing silence")
    print(f"Mode: {'APPLY' if apply else 'DRY-RUN'}")
    print()

    for seg_id, last_word_end_ms, current_duration_ms, trailing_ms in candidates:
        wav_path = WAV_DIR / f"{seg_id}.wav"
        m4a_path = M4A_DIR / f"{seg_id}.m4a"

        new_end_ms = last_word_end_ms + TAIL_MS
        saved_ms = current_duration_ms - new_end_ms

        print(f"  {seg_id}: {current_duration_ms}ms → {new_end_ms}ms "
              f"(trim {saved_ms}ms, trailing was {trailing_ms}ms)")

        if not apply:
            total_saved_ms += saved_ms
            trimmed += 1
            continue

        if not wav_path.exists():
            print(f"    SKIP: {wav_path} not found")
            skipped += 1
            continue

        try:
            # Load WAV
            audio, sr = sf.read(wav_path, dtype="float32")

            # Calculate trim point in samples
            new_end_samples = int(new_end_ms * sr / 1000)
            if new_end_samples >= len(audio):
                print(f"    SKIP: trim point ({new_end_samples}) >= audio length ({len(audio)})")
                skipped += 1
                continue

            # Trim
            trimmed_audio = audio[:new_end_samples]

            # Apply fade-out
            fade_samples = int(FADE_MS * sr / 1000)
            if fade_samples > 0 and fade_samples <= len(trimmed_audio):
                fade = np.linspace(1.0, 0.0, fade_samples, dtype=np.float32)
                trimmed_audio[-fade_samples:] *= fade

            # Overwrite WAV
            sf.write(str(wav_path), trimmed_audio, sr)

            # Re-master to M4A
            master_one_segment(str(wav_path), str(m4a_path),
                               TARGET_LUFS, TARGET_TP)

            # Update manifest duration
            actual_duration_ms = int(len(trimmed_audio) / sr * 1000)
            segments[seg_id]["duration_ms"] = actual_duration_ms

            total_saved_ms += saved_ms
            trimmed += 1

        except Exception as e:
            print(f"    ERROR: {e}")
            errors += 1

    if apply and trimmed > 0:
        save_json_atomic(manifest, MANIFEST_PATH)
        print(f"\nUpdated {MANIFEST_PATH.name}")

    print(f"\n{'='*50}")
    print(f"{'Applied' if apply else 'Would trim'}: {trimmed} segments")
    print(f"Skipped: {skipped}")
    print(f"Errors: {errors}")
    print(f"Total silence removed: {total_saved_ms/1000:.1f}s")

    if not apply and trimmed > 0:
        print(f"\nRun with --apply to execute.")


if __name__ == "__main__":
    main()
