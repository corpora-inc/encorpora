#!/usr/bin/env python3
"""
F5-TTS audio generation pipeline for Chinese narration.

Uses F5-TTS (non-autoregressive flow matching) for Chinese audio with
cross-lingual voice cloning from an English reference voice. Produces
significantly fewer artifacts than autoregressive models (Chatterbox)
for tonal languages like Chinese.

Pipeline per segment:
    1. F5-TTS inference → raw WAV
    2. stable-ts forced alignment → word-level timestamps
    3. Enhanced mastering chain (ffmpeg) → cleaned WAV
    4. Opus encoding → final delivery format
    5. Manifest JSON with words/timing (crash-safe incremental save)

Usage:
    python generate_audio_f5tts.py \
        --segments ../01-mystery-of-monte-alban/pack/segments_zh.json \
        --voice ../../../../voices/data/ian-narration.wav \
        --output-dir ../01-mystery-of-monte-alban/pack/audio/zh \
        --manifest ../01-mystery-of-monte-alban/pack/audio_manifest_zh.json \
        --device cuda --resume

    # Higher quality (slower):
    python generate_audio_f5tts.py \
        --segments ../01-mystery-of-monte-alban/pack/segments_zh.json \
        --voice ../../../../voices/data/ian-narration.wav \
        --output-dir ../01-mystery-of-monte-alban/pack/audio/zh \
        --manifest ../01-mystery-of-monte-alban/pack/audio_manifest_zh.json \
        --nfe-step 64 --device cuda --resume

Requires:
    - PyTorch cu130 (for DGX Spark GB10)
    - f5-tts (non-autoregressive flow matching TTS)
    - stable-ts (Whisper-based forced alignment)
    - soundfile, numpy
    - ffmpeg (system package, for mastering + Opus encoding)
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


def load_manifest(manifest_path: str) -> dict | None:
    """Load existing manifest for resume support, or return None."""
    if os.path.exists(manifest_path):
        with open(manifest_path, "r") as f:
            return json.load(f)
    return None


def save_manifest(manifest: dict, manifest_path: str):
    """Save manifest to disk (crash recovery via atomic replace)."""
    os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
    tmp_path = manifest_path + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(manifest, f, indent=2)
    os.replace(tmp_path, manifest_path)


def build_mastering_chain() -> str:
    """Build enhanced ffmpeg audio filter chain for TTS mastering.

    Enhanced over the original Chatterbox chain:
        - afftdn nr=15 (was 12) — slightly more aggressive noise reduction
        - adeclick threshold=1.5 (was 2) — catch more clicks
        - Added de-esser (band-split approach) for sibilant control
        - Rest of chain unchanged: highpass, agate, acompressor, alimiter

    Chain order:
        1. highpass  — remove sub-80Hz rumble/DC offset
        2. adeclick  — interpolate over pops/clicks (tighter threshold)
        3. afftdn    — FFT spectral denoising (moderate, adaptive)
        4. agate     — noise gate for clean silences
        5. de-esser  — band-split sibilance reduction (4kHz-8kHz)
        6. acompressor — gentle 2:1 compression to even out levels
        7. alimiter  — true peak safety limiter at -3 dBTP
    """
    return ",".join([
        # 1. Remove sub-bass rumble
        "highpass=f=80:width_type=q:width=0.7",
        # 2. De-click — tighter threshold catches more artifacts
        "adeclick=window=55:overlap=75:threshold=1.5",
        # 3. Spectral denoising — slightly more aggressive
        "afftdn=nr=15:nf=-35:tn=1",
        # 4. Noise gate for clean silences
        "agate=threshold=0.018:range=0.01:attack=5:release=50",
        # 5. De-esser: compress only the 4-8kHz sibilant band
        # Split to band → compress → mix back
        "asplit[a][b]",
        "[a]bandpass=f=6000:width_type=h:width=4000,"
        "acompressor=threshold=0.05:ratio=4:attack=1:release=50[sib]",
        "[b][sib]amix=inputs=2:weights=1 0.4",
        # 6. Gentle 2:1 compression to even out levels
        "acompressor=threshold=0.1:ratio=2:attack=10:release=100:makeup=1",
        # 7. True peak safety limiter at -3 dBTP
        "alimiter=limit=0.708:level=false",
    ])


def build_mastering_chain_simple() -> str:
    """Simpler mastering chain without de-esser (fallback if de-esser causes issues).

    Same as original but with tighter adeclick and afftdn.
    """
    return ",".join([
        "highpass=f=80:width_type=q:width=0.7",
        "adeclick=window=55:overlap=75:threshold=1.5",
        "afftdn=nr=15:nf=-35:tn=1",
        "agate=threshold=0.018:range=0.01:attack=5:release=50",
        "acompressor=threshold=0.1:ratio=2:attack=10:release=100:makeup=1",
        "alimiter=limit=0.708:level=false",
    ])


def encode_audio(
    wav_path: str,
    output_path: str,
    fmt: str = "opus",
    use_deesser: bool = True,
):
    """Encode WAV to target format using ffmpeg with mastering filter chain."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if use_deesser:
        af_chain = build_mastering_chain()
    else:
        af_chain = build_mastering_chain_simple()

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
        cmd, capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        if use_deesser:
            # De-esser uses complex filter graph; fall back to simple chain
            print(f"    De-esser chain failed, falling back to simple chain...")
            return encode_audio(wav_path, output_path, fmt, use_deesser=False)
        print(f"  ffmpeg error: {result.stderr[:500]}")
        raise RuntimeError(f"ffmpeg encoding failed for {wav_path}")


def align_audio(
    wav_path: str,
    transcript: str,
    whisper_model,
    language: str = "zh",
) -> list[dict]:
    """Force-align audio against transcript using stable-ts.

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
    ref_text: str,
    nfe_step: int = 32,
    cfg_strength: float = 2.0,
    speed: float = 1.0,
    seed: int | None = None,
) -> tuple[np.ndarray, int]:
    """Generate speech audio from text using F5-TTS.

    F5-TTS is non-autoregressive (flow matching), so it doesn't suffer
    from the hallucination artifacts that plague AR models on tonal languages.

    Returns (audio_array, sample_rate).
    """
    wav, sr, _spec = tts_model.infer(
        ref_file=voice_path,
        ref_text=ref_text,
        gen_text=text,
        nfe_step=nfe_step,
        cfg_strength=cfg_strength,
        speed=speed,
        seed=seed,
    )
    return wav, sr


def process_segment(
    segment: dict,
    voice_path: str,
    tts_model,
    ref_text: str,
    whisper_model,
    output_dir: str,
    fmt: str,
    language: str,
    keep_wav: bool,
    nfe_step: int = 32,
    cfg_strength: float = 2.0,
    speed: float = 1.0,
    seed: int | None = None,
) -> dict | None:
    """Process a single segment: TTS -> WAV -> Align -> Encode -> Manifest entry.

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
    print(f"  [{seg_id}] Generating F5-TTS ({len(tts_text)} chars)...")
    t0 = time.time()
    audio, sample_rate = generate_tts(
        tts_text, voice_path, tts_model, ref_text,
        nfe_step=nfe_step, cfg_strength=cfg_strength,
        speed=speed, seed=seed,
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

    # Step 4: Encode to target format with mastering chain
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
        description="Generate Chinese narrated audio using F5-TTS"
    )
    parser.add_argument(
        "--segments", required=True,
        help="Path to segments_zh.json"
    )
    parser.add_argument(
        "--voice", required=True,
        help="Path to voice sample WAV (e.g. ian-narration.wav)"
    )
    parser.add_argument(
        "--language", default="zh",
        help="Language code for alignment and manifest (default: zh)"
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
        "--nfe-step", type=int, default=32,
        help="F5-TTS NFE steps — higher = better quality, slower (default: 32)"
    )
    parser.add_argument(
        "--cfg-strength", type=float, default=2.0,
        help="F5-TTS classifier-free guidance strength (default: 2.0)"
    )
    parser.add_argument(
        "--speed", type=float, default=1.0,
        help="Speech speed multiplier (default: 1.0)"
    )
    parser.add_argument(
        "--seed", type=int, default=None,
        help="Random seed for reproducibility (default: random)"
    )
    parser.add_argument(
        "--f5-model", default="F5TTS_v1_Base",
        help="F5-TTS model name (default: F5TTS_v1_Base)"
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
            "engine": "f5-tts",
            "model": args.f5_model,
            "nfe_step": args.nfe_step,
            "cfg_strength": args.cfg_strength,
            "sample_rate": 24000,  # Updated after model load
            "segments": {},
        }

    completed = set(manifest["segments"].keys()) if args.resume else set()
    if completed:
        print(f"Resuming: {len(completed)} segments already completed")

    # Filter to segments with TTS text, excluding already-done
    tts_segments = [
        s for s in segments
        if s.get("tts", {}).get("text", "").strip()
        and s["id"] not in completed
    ]
    total = len(tts_segments)
    print(f"\nProcessing {total} segments ({len(completed)} already done)")

    if total == 0:
        print("Nothing to do!")
        sys.exit(0)

    # Load F5-TTS model
    print(f"\nLoading F5-TTS ({args.f5_model}) on {args.device}...")
    t0 = time.time()
    from f5_tts.api import F5TTS
    tts_model = F5TTS(model=args.f5_model, device=args.device)
    print(f"F5-TTS loaded in {time.time() - t0:.1f}s")

    # Update manifest sample rate from model
    manifest["sample_rate"] = tts_model.target_sample_rate

    # Transcribe reference audio (F5-TTS needs ref_text)
    print(f"\nTranscribing reference voice for F5-TTS...")
    t0 = time.time()
    ref_text = tts_model.transcribe(args.voice)
    print(f"Ref text ({time.time() - t0:.1f}s): {ref_text[:80]}...")

    # Load Whisper for alignment
    print(f"\nLoading Whisper {args.whisper_model} for alignment...")
    t0 = time.time()
    import stable_whisper
    whisper_model = stable_whisper.load_model(
        args.whisper_model, device=args.device
    )
    print(f"Whisper loaded in {time.time() - t0:.1f}s")

    # Process segments
    print(f"\n{'='*60}")
    print(f"Starting F5-TTS audio generation pipeline")
    print(f"  Language: {args.language}")
    print(f"  NFE steps: {args.nfe_step}")
    print(f"  CFG strength: {args.cfg_strength}")
    print(f"  Speed: {args.speed}")
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
                ref_text=ref_text,
                whisper_model=whisper_model,
                output_dir=args.output_dir,
                fmt=args.format,
                language=args.language,
                keep_wav=args.keep_wav,
                nfe_step=args.nfe_step,
                cfg_strength=args.cfg_strength,
                speed=args.speed,
                seed=args.seed,
            )

            if entry is not None:
                manifest["segments"][seg_id] = entry
                success_count += 1

            # Save manifest after every segment (crash recovery)
            save_manifest(manifest, args.manifest)

        except Exception as e:
            print(f"  ERROR processing {seg_id}: {e}")
            error_count += 1
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
    print(f"F5-TTS pipeline complete!")
    print(f"  Language: {args.language}")
    print(f"  Engine: F5-TTS ({args.f5_model})")
    print(f"  NFE steps: {args.nfe_step}")
    print(f"  Segments processed: {success_count}")
    print(f"  Errors: {error_count}")
    print(f"  Total time: {elapsed:.0f}s ({elapsed/60:.1f}min)")
    print(f"  Manifest: {args.manifest}")
    print(f"  Audio dir: {args.output_dir}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
