#!/usr/bin/env python3
"""
Multilingual voice A/B comparison across all 4 voice samples × 3 languages.

Tests every voice sample against representative segments in en/es/zh to find
the best voice for each language. Outputs 60 WAVs (4 voices × 3 langs × 5 segs).

Voice samples:
    V1-original         — ian-narration.wav (original, softer)
    V2-spanish-loud     — ian-new-narration-spanish-loud.wav
    V3-chinese          — ian-new-narration-try-chinese.wav
    V4-chill-clear      — ian-new-narration-try-more-chill-clear.wav

Test segments (diverse lengths and content):
    ch00-012  — short (6–19 chars depending on language)
    ch00-002  — intro sentence (~34 chars)
    ch00-005  — numbers/dates (~104 chars)
    ch02-106  — proper names (~176 chars)
    ch07-458  — long/stress test (~387 chars)

Output structure:
    pack/audio/voice-comparison/{lang}/{voice_name}/{seg_id}.wav

Usage:
    python compare_voices_multilingual.py --device cuda
    python compare_voices_multilingual.py --device cuda --langs es zh
    python compare_voices_multilingual.py --device cuda --voices V1-original V4-chill-clear
"""

# ---------------------------------------------------------------------------
# Suppress noisy upstream warnings before any imports touch them
# ---------------------------------------------------------------------------
import logging
import warnings

# pkg_resources deprecation (from perth)
warnings.filterwarnings("ignore", message="pkg_resources is deprecated")
# PyTorch sm_121 / sm_120 capability warning (harmless on GB10)
warnings.filterwarnings("ignore", message="Found GPU")
# diffusers LoRACompatibleLinear deprecation
warnings.filterwarnings("ignore", message="LoRACompatibleLinear")
# torch.backends.cuda.sdp_kernel() deprecation
warnings.filterwarnings("ignore", message=".*sdp_kernel.*")
# transformers "generation flags are not valid" noise
warnings.filterwarnings("ignore", message=".*generation flags are not valid.*")

# Chatterbox alignment analyzer EOS/repetition warnings → DEBUG only
logging.getLogger("chatterbox.models.t3.inference.alignment_stream_analyzer").setLevel(
    logging.ERROR
)

# Patch Llama attention BEFORE any model loading — the multilingual model's
# AlignmentStreamAnalyzer requires output_attentions=True, which is incompatible
# with SDPA. Switch to eager attention implementation.
import chatterbox.models.t3.llama_configs as _llama_cfg
_llama_cfg.LLAMA_520M_CONFIG_DICT["attn_implementation"] = "eager"

import argparse
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
BOOK_DIR = SCRIPT_DIR.parent / "01-mystery-of-monte-alban"
PACK_DIR = BOOK_DIR / "pack"
VOICES_DIR = SCRIPT_DIR.parent.parent.parent / "voices" / "data"

VOICES = {
    "V1-original": "ian-narration.wav",
    "V2-spanish-loud": "ian-new-narration-spanish-loud.wav",
    "V3-chinese": "ian-new-narration-try-chinese.wav",
    "V4-chill-clear": "ian-new-narration-try-more-chill-clear.wav",
}

LANGUAGES = ["en", "es", "zh"]

SEGMENTS_FILES = {
    "en": PACK_DIR / "segments.json",
    "es": PACK_DIR / "segments_es.json",
    "zh": PACK_DIR / "segments_zh.json",
}

# Representative segments for A/B testing across all languages:
#   ch00-012: Short       — "The script did not." / "La escritura no." / "文字却没有。"
#   ch00-002: Intro       — "This book is about a real mystery."
#   ch00-005: Numbers     — 2,500 years ago, flattened a mountain...
#   ch02-106: Names       — Joyce Marcus, Kent Flannery, 1975...
#   ch07-458: Long        — Maya glyphs deciphered, stress test
TEST_SEGMENTS = ["ch00-012", "ch00-002", "ch00-005", "ch02-106", "ch07-458"]

# Conservative TTS params (same as generate_audio_all.py)
TTS_PARAMS = {
    "cfg_weight": 0.8,
    "exaggeration": 0.3,
    "temperature": 0.6,
    "top_p": 0.85,
    "min_p": 0.10,
    "repetition_penalty": 2.5,
}


def load_segments_for_lang(lang: str) -> dict[str, str]:
    """Load segment ID → tts.text mapping for a language."""
    path = SEGMENTS_FILES[lang]
    with open(path, "r") as f:
        data = json.load(f)

    lookup = {}
    for seg in data["segments"]:
        tts_text = seg.get("tts", {}).get("text", "").strip()
        if tts_text:
            lookup[seg["id"]] = tts_text
    return lookup


def main():
    parser = argparse.ArgumentParser(
        description="Multilingual voice A/B comparison (4 voices × 3 langs × 5 segs)"
    )
    parser.add_argument(
        "--device", default="cuda",
        help="Device for TTS model (default: cuda)",
    )
    parser.add_argument(
        "--langs", nargs="+", default=LANGUAGES,
        choices=LANGUAGES,
        help=f"Languages to test (default: {LANGUAGES})",
    )
    parser.add_argument(
        "--voices", nargs="+", default=list(VOICES.keys()),
        choices=list(VOICES.keys()),
        help=f"Voice presets to test (default: all {len(VOICES)})",
    )
    parser.add_argument(
        "--segment-ids", nargs="+", default=TEST_SEGMENTS,
        help=f"Segment IDs to test (default: {TEST_SEGMENTS})",
    )
    parser.add_argument(
        "--output-dir", default=None,
        help="Output directory (default: pack/audio/voice-comparison)",
    )
    args = parser.parse_args()

    output_base = Path(args.output_dir) if args.output_dir else PACK_DIR / "audio" / "voice-comparison"

    # Validate voice files exist
    for vname in args.voices:
        vpath = VOICES_DIR / VOICES[vname]
        if not vpath.exists():
            print(f"ERROR: Voice file not found: {vpath}")
            sys.exit(1)

    # Load segment texts per language
    lang_segments = {}
    for lang in args.langs:
        lookup = load_segments_for_lang(lang)
        valid = []
        for sid in args.segment_ids:
            if sid in lookup:
                valid.append((sid, lookup[sid]))
            else:
                print(f"WARNING: Segment {sid} not found in {lang}, skipping")
        lang_segments[lang] = valid

    total_files = sum(
        len(segs) * len(args.voices) for segs in lang_segments.values()
    )

    print(f"\nVoice Comparison Setup")
    print(f"  Voices: {len(args.voices)} — {', '.join(args.voices)}")
    print(f"  Languages: {args.langs}")
    print(f"  Segments per language: {len(args.segment_ids)}")
    print(f"  Total files to generate: {total_files}")
    print(f"  TTS params: {TTS_PARAMS}")
    print(f"  Output: {output_base}")

    # Load model once
    print(f"\nLoading ChatterboxMultilingualTTS on {args.device}...")
    t0 = time.time()
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    tts_model = ChatterboxMultilingualTTS.from_pretrained(device=args.device)
    sample_rate = tts_model.sr
    print(f"Model loaded in {time.time() - t0:.1f}s (sr={sample_rate})")

    # Generate all combinations
    count = 0
    t_start = time.time()

    for lang in args.langs:
        segs = lang_segments[lang]
        if not segs:
            continue

        print(f"\n{'='*60}")
        print(f"Language: {lang} ({len(segs)} segments)")
        print(f"{'='*60}")

        for vname in args.voices:
            voice_path = str(VOICES_DIR / VOICES[vname])
            out_dir = output_base / lang / vname
            out_dir.mkdir(parents=True, exist_ok=True)

            print(f"\n  Voice: {vname} ({VOICES[vname]})")

            for seg_id, tts_text in segs:
                count += 1
                wav_path = out_dir / f"{seg_id}.wav"

                # Skip if already generated
                if wav_path.exists():
                    print(f"    [{count}/{total_files}] {seg_id} — already exists, skipping")
                    continue

                print(f"    [{count}/{total_files}] {seg_id} ({len(tts_text)} chars)")

                t0 = time.time()
                try:
                    wav_tensor = tts_model.generate(
                        tts_text,
                        language_id=lang,
                        audio_prompt_path=voice_path,
                        **TTS_PARAMS,
                    )

                    if isinstance(wav_tensor, torch.Tensor):
                        audio = wav_tensor.squeeze().cpu().numpy()
                    else:
                        audio = np.array(wav_tensor).squeeze()

                    duration_ms = int(len(audio) / sample_rate * 1000)
                    t_gen = time.time() - t0

                    sf.write(str(wav_path), audio, sample_rate)
                    print(f"      {duration_ms}ms audio in {t_gen:.1f}s → {wav_path.name}")

                except Exception as e:
                    print(f"      ERROR: {e}")
                    continue

    # Free GPU memory
    del tts_model
    torch.cuda.empty_cache()

    elapsed = time.time() - t_start
    print(f"\n{'='*60}")
    print(f"Done! Generated {count} files in {elapsed:.0f}s ({elapsed/60:.1f}min)")
    print(f"\nOutput directory structure:")
    for lang in args.langs:
        print(f"  {lang}/")
        for vname in args.voices:
            print(f"    {vname}/")
            for sid, _ in lang_segments.get(lang, []):
                print(f"      {sid}.wav")
    print(f"\nTip: Listen to files grouped by segment ID to compare voices side-by-side.")
    print(f"     e.g. play en/V1-original/ch00-005.wav then en/V4-chill-clear/ch00-005.wav")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
