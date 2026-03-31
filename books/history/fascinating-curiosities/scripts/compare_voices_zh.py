#!/usr/bin/env python3
"""
Multi-engine Chinese TTS A/B comparison.

Generates the same zh segments across multiple TTS engines/presets so you can
listen side-by-side and pick the best quality before committing to a full run.

Engines tested:
    A. Chatterbox MTL — current params (cfg=0.8, exag=0.5, temp=0.8)
    B. Chatterbox MTL conservative — lower temp/exaggeration, higher rep penalty
    C. F5-TTS default — non-autoregressive flow matching, nfe_step=32
    D. F5-TTS high-quality — nfe_step=64 for better quality

Outputs to: {output-dir}/{engine_name}/{segment_id}.wav

Usage:
    # From tts_venv (has both chatterbox and f5-tts installed)
    python compare_voices_zh.py \
        --segments ../01-mystery-of-monte-alban/pack/segments_zh.json \
        --voice ../../../../voices/data/ian-narration.wav \
        --output-dir ../01-mystery-of-monte-alban/pack/audio/zh-test \
        --device cuda

    # Run only F5-TTS engines (skip Chatterbox loading):
    python compare_voices_zh.py \
        --segments ../01-mystery-of-monte-alban/pack/segments_zh.json \
        --voice ../../../../voices/data/ian-narration.wav \
        --output-dir ../01-mystery-of-monte-alban/pack/audio/zh-test \
        --engines C-f5tts D-f5tts-hq
"""

import argparse
import json
import os
import sys
import time

import numpy as np
import soundfile as sf

# Representative zh segments for A/B testing:
#   - ch00-012: Short (6 chars) — 文字却没有。
#   - ch01-048: Medium (22 chars) — metaphorical, natural pacing test
#   - ch01-045: Long (48 chars) — proper nouns + quoted term "天顶过境"
#   - ch02-106: Numbers/dates (58 chars) — 1975年 + transliterated names
#   - ch07-458: Longest (133 chars) — stress test, proper nouns
DEFAULT_TEST_SEGMENTS = [
    "ch00-012", "ch01-048", "ch01-045", "ch02-106", "ch07-458",
]


# ── Engine definitions ──────────────────────────────────────────────────────

def load_chatterbox(device: str):
    """Load Chatterbox Multilingual TTS model."""
    # Patch Llama attention before loading — multilingual model's
    # AlignmentStreamAnalyzer requires output_attentions=True, which
    # is incompatible with SDPA.
    import chatterbox.models.t3.llama_configs as _llama_cfg
    _llama_cfg.LLAMA_520M_CONFIG_DICT["attn_implementation"] = "eager"

    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    print(f"  Loading Chatterbox Multilingual TTS on {device}...")
    t0 = time.time()
    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    print(f"  Chatterbox loaded in {time.time() - t0:.1f}s")
    return model


def load_f5tts(device: str):
    """Load F5-TTS model."""
    from f5_tts.api import F5TTS
    print(f"  Loading F5-TTS (F5TTS_v1_Base) on {device}...")
    t0 = time.time()
    model = F5TTS(model="F5TTS_v1_Base", device=device)
    print(f"  F5-TTS loaded in {time.time() - t0:.1f}s")
    return model


def generate_chatterbox(
    model, text: str, voice_path: str, params: dict
) -> tuple[np.ndarray, int]:
    """Generate audio with Chatterbox Multilingual."""
    import torch
    wav_tensor = model.generate(
        text,
        language_id="zh",
        audio_prompt_path=voice_path,
        **params,
    )
    if isinstance(wav_tensor, torch.Tensor):
        audio = wav_tensor.squeeze().cpu().numpy()
    else:
        audio = np.array(wav_tensor).squeeze()
    return audio, model.sr


def generate_f5tts(
    model, text: str, voice_path: str, params: dict
) -> tuple[np.ndarray, int]:
    """Generate audio with F5-TTS."""
    # F5-TTS needs ref_text — auto-transcribe the reference audio
    if not hasattr(model, "_ref_text_cache"):
        model._ref_text_cache = {}
    if voice_path not in model._ref_text_cache:
        print(f"    Transcribing reference audio for F5-TTS...")
        model._ref_text_cache[voice_path] = model.transcribe(voice_path)
        print(f"    Ref text: {model._ref_text_cache[voice_path][:80]}...")
    ref_text = model._ref_text_cache[voice_path]

    wav, sr, _spec = model.infer(
        ref_file=voice_path,
        ref_text=ref_text,
        gen_text=text,
        **params,
    )
    return wav, sr


# Engine preset registry
ENGINES = {
    "A-cbox-default": {
        "loader": "chatterbox",
        "generator": "chatterbox",
        "params": {
            "cfg_weight": 0.8,
            "exaggeration": 0.5,
            "temperature": 0.8,
            "top_p": 1.0,
            "min_p": 0.05,
            "repetition_penalty": 2.0,
        },
        "description": "Chatterbox MTL — current params",
    },
    "B-cbox-conserv": {
        "loader": "chatterbox",
        "generator": "chatterbox",
        "params": {
            "cfg_weight": 0.8,
            "exaggeration": 0.3,
            "temperature": 0.6,
            "top_p": 0.85,
            "min_p": 0.10,
            "repetition_penalty": 2.5,
        },
        "description": "Chatterbox MTL — conservative (lower temp, higher rep_penalty)",
    },
    "C-f5tts": {
        "loader": "f5tts",
        "generator": "f5tts",
        "params": {
            "cfg_strength": 2,
            "nfe_step": 32,
            "speed": 1.0,
        },
        "description": "F5-TTS default — non-AR flow matching, nfe_step=32",
    },
    "D-f5tts-hq": {
        "loader": "f5tts",
        "generator": "f5tts",
        "params": {
            "cfg_strength": 2,
            "nfe_step": 64,
            "speed": 1.0,
        },
        "description": "F5-TTS high-quality — nfe_step=64",
    },
}


def main():
    parser = argparse.ArgumentParser(
        description="Multi-engine Chinese TTS A/B comparison"
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
        "--output-dir", required=True,
        help="Output directory (e.g. pack/audio/zh-test)"
    )
    parser.add_argument(
        "--device", default="cuda",
        help="Device for TTS models (default: cuda)"
    )
    parser.add_argument(
        "--segment-ids", nargs="+", default=DEFAULT_TEST_SEGMENTS,
        help=f"Segment IDs to test (default: {DEFAULT_TEST_SEGMENTS})"
    )
    parser.add_argument(
        "--engines", nargs="+", default=list(ENGINES.keys()),
        choices=list(ENGINES.keys()),
        help="Which engine presets to test (default: all)"
    )
    args = parser.parse_args()

    # Validate
    if not os.path.exists(args.segments):
        print(f"ERROR: Segments file not found: {args.segments}")
        sys.exit(1)
    if not os.path.exists(args.voice):
        print(f"ERROR: Voice sample not found: {args.voice}")
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
            # Fall back to main text for heading segments
            tts_text = seg.get("text", "").strip()
        if not tts_text:
            print(f"WARNING: Segment {sid} has no text, skipping")
            continue
        test_segments.append((sid, tts_text))

    if not test_segments:
        print("ERROR: No valid test segments found")
        sys.exit(1)

    # Determine which engine backends we need to load
    active_engines = {name: ENGINES[name] for name in args.engines}
    need_chatterbox = any(e["loader"] == "chatterbox" for e in active_engines.values())
    need_f5tts = any(e["loader"] == "f5tts" for e in active_engines.values())

    print(f"\nTest segments ({len(test_segments)}):")
    for sid, text in test_segments:
        print(f"  {sid} ({len(text)} chars): {text[:60]}{'...' if len(text) > 60 else ''}")

    print(f"\nEngine presets ({len(active_engines)}):")
    for name, eng in active_engines.items():
        print(f"  {name}: {eng['description']}")

    total_files = len(test_segments) * len(active_engines)
    print(f"\nTotal files to generate: {total_files}")

    # Load models
    models = {}
    if need_chatterbox:
        models["chatterbox"] = load_chatterbox(args.device)
    if need_f5tts:
        models["f5tts"] = load_f5tts(args.device)

    generators = {
        "chatterbox": generate_chatterbox,
        "f5tts": generate_f5tts,
    }

    # Generate all combinations
    count = 0
    t_start = time.time()

    for engine_name, engine_cfg in active_engines.items():
        print(f"\n{'='*60}")
        print(f"Engine: {engine_name}")
        print(f"  {engine_cfg['description']}")
        for k, v in engine_cfg["params"].items():
            print(f"  {k}: {v}")
        print(f"{'='*60}")

        engine_dir = os.path.join(args.output_dir, engine_name)
        os.makedirs(engine_dir, exist_ok=True)

        model = models[engine_cfg["loader"]]
        gen_fn = generators[engine_cfg["generator"]]

        for seg_id, tts_text in test_segments:
            count += 1
            print(f"\n  [{count}/{total_files}] {engine_name}/{seg_id} "
                  f"({len(tts_text)} chars)")

            t0 = time.time()
            try:
                audio, sample_rate = gen_fn(
                    model, tts_text, args.voice, engine_cfg["params"]
                )
            except Exception as e:
                print(f"    ERROR: {e}")
                continue

            duration_ms = int(len(audio) / sample_rate * 1000)
            t_gen = time.time() - t0
            print(f"    Generated: {duration_ms}ms audio in {t_gen:.1f}s "
                  f"(sr={sample_rate})")

            # Save as WAV for easy listening comparison
            wav_path = os.path.join(engine_dir, f"{seg_id}.wav")
            sf.write(wav_path, audio, sample_rate)
            print(f"    Saved: {wav_path}")

    # Summary
    elapsed = time.time() - t_start
    print(f"\n{'='*60}")
    print(f"Done! Generated {count} files in {elapsed:.0f}s ({elapsed/60:.1f}min)")
    print(f"\nCompare by listening to files in:")
    print(f"  {args.output_dir}/")
    for engine_name in active_engines:
        print(f"    {engine_name}/")
        for seg_id, _ in test_segments:
            print(f"      {seg_id}.wav")
    print(f"\nTip: Use a media player or `aplay` to compare side-by-side.")
    print(f"     F5-TTS outputs at 24kHz; Chatterbox at model.sr (likely 24kHz).")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
