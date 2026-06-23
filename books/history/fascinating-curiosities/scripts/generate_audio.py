#!/usr/bin/env python3
"""
Audio generation pipeline for Fascinating Curiosities book series.

Generates narrated audio for every segment using Chatterbox TTS with a voice sample,
runs forced alignment via stable-ts to get exact word-level timestamps,
encodes to Opus for mobile delivery, and produces an audio manifest.

Usage:
    python generate_audio.py \
        --segments ../01-mystery-of-monte-alban/pack/segments.json \
        --voice ../../../voices/data/ian-narration.wav \
        --language en \
        --output-dir ../01-mystery-of-monte-alban/pack/audio/en \
        --manifest ../01-mystery-of-monte-alban/pack/audio_manifest_en.json \
        --format opus \
        --resume \
        --device cuda

Requires:
    - PyTorch cu130 (for DGX Spark GB10)
    - chatterbox-tts
    - stable-ts (Whisper-based forced alignment)
    - soundfile, numpy
    - ffmpeg (system package, for Opus encoding)
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch


def check_ffmpeg():
    """Verify ffmpeg is available for audio encoding."""
    if shutil.which("ffmpeg") is None:
        print("ERROR: ffmpeg not found. Install with: sudo apt install ffmpeg")
        sys.exit(1)


def load_segments(segments_path: str) -> dict:
    """Load segments.json and return the parsed data."""
    with open(segments_path, "r") as f:
        data = json.load(f)
    print(f"Loaded {data['total_segments']} segments from {segments_path}")
    return data


def load_manifest(manifest_path: str) -> dict:
    """Load existing manifest for resume support, or return empty structure."""
    if os.path.exists(manifest_path):
        with open(manifest_path, "r") as f:
            return json.load(f)
    return None


def save_manifest(manifest: dict, manifest_path: str):
    """Save manifest to disk (crash recovery)."""
    os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
    tmp_path = manifest_path + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(manifest, f, indent=2)
    os.replace(tmp_path, manifest_path)


def build_mastering_chain() -> str:
    """Build the ffmpeg audio filter chain for mastering TTS output.

    Chain order:
        1. highpass  — remove sub-80Hz rumble/DC offset
        2. adeclick  — interpolate over pops/clicks
        3. afftdn    — FFT spectral denoising (gentle, adaptive)
        4. agate     — noise gate for clean silences
        5. acompressor — gentle 2:1 compression to even out levels
        6. alimiter  — true peak safety limiter at -3 dBTP
    """
    return ",".join([
        "highpass=f=80:width_type=q:width=0.7",
        "adeclick=window=55:overlap=75:threshold=2",
        "afftdn=nr=12:nf=-40:tn=1",
        "agate=threshold=0.018:range=0.01:attack=5:release=50",
        "acompressor=threshold=0.1:ratio=2:attack=10:release=100:makeup=1",
        "alimiter=limit=0.708:level=false",
    ])


def encode_audio(wav_path: str, output_path: str, fmt: str = "opus"):
    """Encode WAV to target format using ffmpeg with mastering filter chain."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    af_chain = build_mastering_chain()

    if fmt == "opus":
        cmd = [
            "ffmpeg", "-y", "-i", wav_path,
            "-af", af_chain,
            "-c:a", "libopus",
            "-b:a", "48000",
            "-application", "voip",
            "-vbr", "on",
            output_path,
        ]
    elif fmt == "aac":
        cmd = [
            "ffmpeg", "-y", "-i", wav_path,
            "-af", af_chain,
            "-c:a", "aac",
            "-b:a", "64000",
            output_path,
        ]
    else:
        raise ValueError(f"Unsupported format: {fmt}")

    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        print(f"  ffmpeg error: {result.stderr[:500]}")
        raise RuntimeError(f"ffmpeg encoding failed for {wav_path}")


def align_audio(
    wav_path: str,
    transcript: str,
    whisper_model,
    language: str = "en",
) -> list[dict]:
    """
    Force-align audio against known transcript using stable-ts.

    stable-ts wraps Whisper to listen to the audio while knowing the transcript,
    reporting exactly when each word starts and ends.

    Returns list of {"word": str, "start_ms": int, "end_ms": int}.
    """
    result = whisper_model.align(
        wav_path,
        transcript,
        language=language,
    )

    words = []
    for segment in result.segments:
        for word_info in segment.words:
            words.append({
                "word": word_info.word.strip(),
                "start_ms": int(word_info.start * 1000),
                "end_ms": int(word_info.end * 1000),
            })

    # Filter empty words
    words = [w for w in words if w["word"]]
    return words


def generate_tts(
    text: str,
    voice_path: str,
    tts_model,
    device: str = "cuda",
    exaggeration: float = 0.5,
    cfg_weight: float = 0.5,
    temperature: float = 0.8,
    top_p: float = 1.0,
    min_p: float = 0.05,
    repetition_penalty: float = 1.2,
) -> tuple[np.ndarray, int]:
    """
    Generate speech audio from text using Chatterbox TTS.

    Returns (audio_array, sample_rate).
    """
    wav_tensor = tts_model.generate(
        text,
        audio_prompt_path=voice_path,
        exaggeration=exaggeration,
        cfg_weight=cfg_weight,
        temperature=temperature,
        top_p=top_p,
        min_p=min_p,
        repetition_penalty=repetition_penalty,
    )

    # Chatterbox returns a tensor, convert to numpy
    if isinstance(wav_tensor, torch.Tensor):
        audio = wav_tensor.squeeze().cpu().numpy()
    else:
        audio = np.array(wav_tensor).squeeze()

    sample_rate = 24000  # Chatterbox default
    return audio, sample_rate


def process_segment(
    segment: dict,
    voice_path: str,
    tts_model,
    whisper_model,
    output_dir: str,
    fmt: str,
    language: str,
    device: str,
    keep_wav: bool,
    exaggeration: float = 0.5,
    cfg_weight: float = 0.5,
    temperature: float = 0.8,
    top_p: float = 1.0,
    min_p: float = 0.05,
    repetition_penalty: float = 1.2,
) -> dict | None:
    """
    Process a single segment: TTS → WAV → Align → Encode → Manifest entry.

    Returns manifest entry dict or None if segment has no TTS text.
    """
    seg_id = segment["id"]
    tts_data = segment.get("tts", {})
    tts_text = tts_data.get("text", "").strip()
    pause_after_ms = tts_data.get("pause_after_ms", 800)

    if not tts_text:
        print(f"  [{seg_id}] No TTS text, skipping")
        return None

    wav_path = os.path.join(output_dir, f"{seg_id}.wav")
    ext = "opus" if fmt == "opus" else "m4a" if fmt == "aac" else fmt
    encoded_path = os.path.join(output_dir, f"{seg_id}.{ext}")

    # Step 1: Generate TTS audio
    print(f"  [{seg_id}] Generating TTS ({len(tts_text)} chars)...")
    t0 = time.time()
    audio, sample_rate = generate_tts(
        tts_text, voice_path, tts_model, device=device,
        exaggeration=exaggeration, cfg_weight=cfg_weight,
        temperature=temperature, top_p=top_p,
        min_p=min_p, repetition_penalty=repetition_penalty,
    )
    t_tts = time.time() - t0
    duration_ms = int(len(audio) / sample_rate * 1000)
    print(f"  [{seg_id}] TTS done: {duration_ms}ms audio in {t_tts:.1f}s")

    # Step 2: Save WAV for alignment
    sf.write(wav_path, audio, sample_rate)

    # Step 3: Force alignment
    print(f"  [{seg_id}] Aligning...")
    t0 = time.time()
    words = align_audio(wav_path, tts_text, whisper_model, language=language)
    t_align = time.time() - t0
    print(f"  [{seg_id}] Aligned {len(words)} words in {t_align:.1f}s")

    # Step 4: Encode to target format
    print(f"  [{seg_id}] Encoding to {fmt}...")
    encode_audio(wav_path, encoded_path, fmt=fmt)

    # Step 5: Clean up WAV if not keeping
    if not keep_wav and os.path.exists(wav_path):
        os.remove(wav_path)

    # Relative path for manifest (relative to pack/ directory)
    rel_path = f"audio/{language}/{seg_id}.{ext}"

    return {
        "file": rel_path,
        "duration_ms": duration_ms,
        "pause_after_ms": pause_after_ms,
        "words": words,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Generate narrated audio for book segments"
    )
    parser.add_argument(
        "--segments", required=True,
        help="Path to segments.json"
    )
    parser.add_argument(
        "--voice", required=True,
        help="Path to voice sample WAV (e.g. ian-narration.wav)"
    )
    parser.add_argument(
        "--language", default="en",
        help="Language code (default: en)"
    )
    parser.add_argument(
        "--output-dir", required=True,
        help="Output directory for audio files"
    )
    parser.add_argument(
        "--manifest", required=True,
        help="Path for output audio_manifest JSON"
    )
    parser.add_argument(
        "--format", default="opus", choices=["opus", "aac"],
        help="Audio encoding format (default: opus)"
    )
    parser.add_argument(
        "--resume", action="store_true",
        help="Skip already-completed segments"
    )
    parser.add_argument(
        "--device", default="cuda",
        help="Device for models (default: cuda)"
    )
    parser.add_argument(
        "--keep-wav", action="store_true",
        help="Retain intermediate WAV files"
    )
    parser.add_argument(
        "--whisper-model", default="base",
        help="Whisper model size for alignment (default: base)"
    )
    parser.add_argument(
        "--exaggeration", type=float, default=0.5,
        help="Chatterbox exaggeration parameter (default: 0.5)"
    )
    parser.add_argument(
        "--cfg-weight", type=float, default=0.5,
        help="Chatterbox CFG weight parameter (default: 0.5)"
    )
    parser.add_argument(
        "--temperature", type=float, default=0.8,
        help="Sampling temperature (default: 0.8)"
    )
    parser.add_argument(
        "--top-p", type=float, default=1.0,
        help="Nucleus sampling threshold (default: 1.0)"
    )
    parser.add_argument(
        "--min-p", type=float, default=0.05,
        help="Minimum probability threshold (default: 0.05)"
    )
    parser.add_argument(
        "--repetition-penalty", type=float, default=1.2,
        help="Repetition penalty (default: 1.2)"
    )
    args = parser.parse_args()

    # Validate inputs
    if not os.path.exists(args.segments):
        print(f"ERROR: Segments file not found: {args.segments}")
        sys.exit(1)
    if not os.path.exists(args.voice):
        print(f"ERROR: Voice sample not found: {args.voice}")
        sys.exit(1)
    check_ffmpeg()

    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)

    # Load segments
    segments_data = load_segments(args.segments)
    segments = segments_data["segments"]

    # Load or create manifest
    manifest = load_manifest(args.manifest) if args.resume else None
    if manifest is None:
        manifest = {
            "language": args.language,
            "voice": os.path.basename(args.voice).replace(".wav", ""),
            "sample_rate": 24000,
            "segments": {},
        }

    completed = set(manifest["segments"].keys()) if args.resume else set()
    if completed:
        print(f"Resuming: {len(completed)} segments already completed")

    # Filter to segments with TTS text, excluding image-only segments
    tts_segments = [
        s for s in segments
        if s.get("tts", {}).get("text", "").strip()
        and s["id"] not in completed
    ]
    total = len(tts_segments)
    print(f"\nProcessing {total} segments ({len(completed)} already done)")

    # Load models
    print(f"\nLoading Chatterbox TTS on {args.device}...")
    t0 = time.time()
    from chatterbox.tts import ChatterboxTTS
    tts_model = ChatterboxTTS.from_pretrained(device=args.device)
    print(f"Chatterbox loaded in {time.time() - t0:.1f}s")

    print(f"\nLoading Whisper {args.whisper_model} for alignment...")
    t0 = time.time()
    import stable_whisper
    whisper_model = stable_whisper.load_model(
        args.whisper_model, device=args.device
    )
    print(f"Whisper loaded in {time.time() - t0:.1f}s")

    # Process segments
    print(f"\n{'='*60}")
    print(f"Starting audio generation pipeline")
    print(f"{'='*60}\n")

    t_start = time.time()
    success_count = 0
    error_count = 0

    for i, segment in enumerate(tts_segments):
        seg_id = segment["id"]
        print(f"\n[{i+1}/{total}] Processing {seg_id}")

        try:
            entry = process_segment(
                segment=segment,
                voice_path=args.voice,
                tts_model=tts_model,
                whisper_model=whisper_model,
                output_dir=args.output_dir,
                fmt=args.format,
                language=args.language,
                device=args.device,
                keep_wav=args.keep_wav,
                exaggeration=args.exaggeration,
                cfg_weight=args.cfg_weight,
                temperature=args.temperature,
                top_p=args.top_p,
                min_p=args.min_p,
                repetition_penalty=args.repetition_penalty,
            )

            if entry is not None:
                manifest["segments"][seg_id] = entry
                success_count += 1

            # Save manifest after every segment (crash recovery)
            save_manifest(manifest, args.manifest)

        except Exception as e:
            print(f"  ERROR processing {seg_id}: {e}")
            error_count += 1
            # Continue to next segment
            continue

        # Progress report every 10 segments
        if (i + 1) % 10 == 0:
            elapsed = time.time() - t_start
            rate = (i + 1) / elapsed * 60
            remaining = (total - i - 1) / rate if rate > 0 else 0
            print(
                f"\n  Progress: {i+1}/{total} "
                f"({elapsed:.0f}s elapsed, "
                f"~{remaining:.0f}min remaining)"
            )

    # Final save
    save_manifest(manifest, args.manifest)

    # Summary
    elapsed = time.time() - t_start
    print(f"\n{'='*60}")
    print(f"Pipeline complete!")
    print(f"  Segments processed: {success_count}")
    print(f"  Errors: {error_count}")
    print(f"  Total time: {elapsed:.0f}s ({elapsed/60:.1f}min)")
    print(f"  Manifest: {args.manifest}")
    print(f"  Audio dir: {args.output_dir}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
