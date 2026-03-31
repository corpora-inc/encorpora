#!/usr/bin/env python3
"""
Voice fidelity A/B comparison for Chatterbox TTS.

Generates the same segments at different parameter presets so you can listen
side-by-side and pick the best voice fidelity before committing to a full run.

Outputs to: pack/audio/en-test/{preset_name}/{segment_id}.opus

Usage:
    python compare_voices.py \
        --segments ../01-mystery-of-monte-alban/pack/segments.json \
        --voice ../../../voices/data/ian-narration.wav \
        --output-dir ../01-mystery-of-monte-alban/pack/audio/en-test \
        --device cuda
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time

import numpy as np
import soundfile as sf
import torch

# Presets: name -> {param: value}
PRESETS = {
    "A-current": {
        "cfg_weight": 0.5,
        "exaggeration": 0.5,
        "temperature": 0.8,
        "top_p": 1.0,
        "min_p": 0.05,
        "repetition_penalty": 1.2,
    },
    "B-high-cfg": {
        "cfg_weight": 0.8,
        "exaggeration": 0.5,
        "temperature": 0.8,
        "top_p": 1.0,
        "min_p": 0.05,
        "repetition_penalty": 1.2,
    },
    "C-conservative": {
        "cfg_weight": 0.8,
        "exaggeration": 0.3,
        "temperature": 0.6,
        "top_p": 0.85,
        "min_p": 0.10,
        "repetition_penalty": 1.2,
    },
    "D-max-fidelity": {
        "cfg_weight": 1.0,
        "exaggeration": 0.3,
        "temperature": 0.5,
        "top_p": 0.80,
        "min_p": 0.15,
        "repetition_penalty": 1.2,
    },
}

# Segments to test (short + long)
TEST_SEGMENT_IDS = ["ch00-001", "ch00-002"]


def encode_opus(wav_path: str, opus_path: str):
    """Encode WAV to Opus."""
    os.makedirs(os.path.dirname(opus_path), exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-i", wav_path,
        "-c:a", "libopus", "-b:a", "48000",
        "-application", "voip", "-vbr", "on",
        opus_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg error: {result.stderr[:500]}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate A/B voice comparison samples"
    )
    parser.add_argument(
        "--segments", required=True,
        help="Path to segments.json"
    )
    parser.add_argument(
        "--voice", required=True,
        help="Path to voice sample WAV"
    )
    parser.add_argument(
        "--output-dir", required=True,
        help="Output directory (e.g. pack/audio/en-test)"
    )
    parser.add_argument(
        "--device", default="cuda",
        help="Device for TTS model (default: cuda)"
    )
    parser.add_argument(
        "--segment-ids", nargs="+", default=TEST_SEGMENT_IDS,
        help=f"Segment IDs to test (default: {TEST_SEGMENT_IDS})"
    )
    args = parser.parse_args()

    # Validate
    if not os.path.exists(args.segments):
        print(f"ERROR: Segments file not found: {args.segments}")
        sys.exit(1)
    if not os.path.exists(args.voice):
        print(f"ERROR: Voice sample not found: {args.voice}")
        sys.exit(1)
    if shutil.which("ffmpeg") is None:
        print("ERROR: ffmpeg not found")
        sys.exit(1)

    # Load segments
    with open(args.segments) as f:
        data = json.load(f)

    seg_lookup = {s["id"]: s for s in data["segments"]}
    test_segments = []
    for sid in args.segment_ids:
        if sid not in seg_lookup:
            print(f"WARNING: Segment {sid} not found, skipping")
            continue
        seg = seg_lookup[sid]
        tts_text = seg.get("tts", {}).get("text", "").strip()
        if not tts_text:
            print(f"WARNING: Segment {sid} has no TTS text, skipping")
            continue
        test_segments.append((sid, tts_text))

    if not test_segments:
        print("ERROR: No valid test segments found")
        sys.exit(1)

    print(f"Test segments: {[s[0] for s in test_segments]}")
    print(f"Presets: {list(PRESETS.keys())}")
    print(f"Total files to generate: {len(test_segments) * len(PRESETS)}")

    # Load Chatterbox
    print(f"\nLoading Chatterbox TTS on {args.device}...")
    t0 = time.time()
    from chatterbox.tts import ChatterboxTTS
    tts_model = ChatterboxTTS.from_pretrained(device=args.device)
    print(f"Loaded in {time.time() - t0:.1f}s")

    # Generate all combinations
    total = len(test_segments) * len(PRESETS)
    count = 0

    for preset_name, params in PRESETS.items():
        print(f"\n{'='*60}")
        print(f"Preset: {preset_name}")
        for k, v in params.items():
            print(f"  {k}: {v}")
        print(f"{'='*60}")

        preset_dir = os.path.join(args.output_dir, preset_name)
        os.makedirs(preset_dir, exist_ok=True)

        for seg_id, tts_text in test_segments:
            count += 1
            print(f"\n  [{count}/{total}] {preset_name}/{seg_id} "
                  f"({len(tts_text)} chars)")

            t0 = time.time()
            wav_tensor = tts_model.generate(
                tts_text,
                audio_prompt_path=args.voice,
                **params,
            )

            if isinstance(wav_tensor, torch.Tensor):
                audio = wav_tensor.squeeze().cpu().numpy()
            else:
                audio = np.array(wav_tensor).squeeze()

            sample_rate = 24000
            duration_ms = int(len(audio) / sample_rate * 1000)
            t_gen = time.time() - t0
            print(f"    Generated: {duration_ms}ms audio in {t_gen:.1f}s")

            # Save WAV (keep for inspection) and Opus
            wav_path = os.path.join(preset_dir, f"{seg_id}.wav")
            opus_path = os.path.join(preset_dir, f"{seg_id}.opus")

            sf.write(wav_path, audio, sample_rate)
            encode_opus(wav_path, opus_path)
            print(f"    Saved: {opus_path}")

    # Summary
    print(f"\n{'='*60}")
    print(f"Done! Generated {count} files.")
    print(f"\nCompare by listening to files in:")
    print(f"  {args.output_dir}/")
    for preset_name in PRESETS:
        print(f"    {preset_name}/")
        for seg_id, _ in test_segments:
            print(f"      {seg_id}.opus  (+ .wav)")
    print(f"\nPick your favorite, then re-run generate_audio.py with those settings.")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
