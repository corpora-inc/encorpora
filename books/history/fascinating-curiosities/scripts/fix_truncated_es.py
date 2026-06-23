#!/usr/bin/env python3
"""
Fix truncated Spanish TTS segments by regenerating with stacking detection.

The ChatterboxMultilingualTTS model stochastically truncates ~3% of Spanish
generations. Forced alignment then stacks unspoken words at the final timestamp.
This script retries those segments (up to 3 attempts each) with higher cfg_weight
and detects stacking to verify completeness.

Usage:
    python fix_truncated_es.py              # full pipeline
    python fix_truncated_es.py --dry-run    # list segments only
"""

# ---------------------------------------------------------------------------
# Suppress noisy warnings
# ---------------------------------------------------------------------------
import warnings
warnings.filterwarnings("ignore", message="pkg_resources is deprecated")
warnings.filterwarnings("ignore", message="Found GPU")
warnings.filterwarnings("ignore", message="LoRACompatibleLinear")
warnings.filterwarnings("ignore", message=".*sdp_kernel.*")
warnings.filterwarnings("ignore", message=".*generation flags are not valid.*")
warnings.filterwarnings("ignore", message=".*output_attentions.*")

import logging
logging.getLogger("chatterbox.models.t3.inference.alignment_stream_analyzer").setLevel(
    logging.ERROR
)

# Patch Llama attention BEFORE any model loading
import chatterbox.models.t3.llama_configs as _llama_cfg
_llama_cfg.LLAMA_520M_CONFIG_DICT["attn_implementation"] = "eager"

import argparse
import gc
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

# ---------------------------------------------------------------------------
# Import reusable helpers from generate_audio_all.py
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from generate_audio_all import (
    trim_tts_output,
    cleanup_tts_memory,
    master_one_segment,
    fix_tts_word,
    TTS_PARAMS,
    TARGET_LUFS,
    TARGET_TP,
    PACK_DIR,
    VOICES_DIR,
    save_json_atomic,
    load_json,
)

VOICE_PATH = VOICES_DIR / "ian-new-narration-spanish-loud.wav"
SEGMENTS_PATH = PACK_DIR / "segments_es.json"
ALIGNMENT_PATH = PACK_DIR / "alignment_es.json"
MANIFEST_PATH = PACK_DIR / "audio_manifest_es.json"
AUDIO_DIR = PACK_DIR / "audio" / "es"
WAV_DIR = AUDIO_DIR / "wav"

# Higher cfg_weight to push model toward completing the full text.
# Keep voice/exaggeration conservative.
RETRY_TTS_PARAMS = {
    **TTS_PARAMS,
    "cfg_weight": 1.0,  # max valid (Chatterbox hard max is 1.0)
}

MAX_RETRIES = 3

# All 31 segments with stacked words (20 severe + 11 borderline)
PROBLEM_IDS = [
    # 3+ stacked words (clearly broken)
    "ch14-845", "ch05-356", "ch11-693", "ch06-417", "ch09-563",
    "ch14-865", "ch04-251", "ch04-260", "ch09-576", "ch14-844",
    "ch05-317", "ch09-559", "ch15-887", "ch15-911", "ch15-981",
    "ch15-1016", "ch05-310", "ch11-688", "ch15-999", "ch15-1008",
    # 1-2 stacked words (borderline)
    "ch07-451", "ch09-607", "ch11-674", "ch13-825", "ch13-837",
    "ch15-989", "ch04-245", "ch08-491", "ch09-575", "ch11-680",
    "ch11-730", "ch12-747", "ch15-947",
]


# ---------------------------------------------------------------------------
# Stacking detection
# ---------------------------------------------------------------------------

def has_stacked_words(words: list[dict], threshold: int = 1) -> int:
    """Count words stacked at the end with 0ms duration."""
    if len(words) < 2:
        return 0
    stacked = 0
    for i in range(len(words) - 1, 0, -1):
        if words[i]["start_ms"] == words[i]["end_ms"]:
            stacked += 1
        else:
            break
    return stacked


def align_segment(whisper_model, wav_path: Path, tts_text: str) -> list[dict]:
    """Run forced alignment and return word list."""
    result = whisper_model.align(str(wav_path), tts_text, language="es")
    words = []
    for wseg in result.segments:
        for word_info in wseg.words:
            w = word_info.word.strip()
            if w:
                words.append({
                    "word": w,
                    "start_ms": int(word_info.start * 1000),
                    "end_ms": int(word_info.end * 1000),
                })
    return words


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--device", default="cuda")
    args = parser.parse_args()

    print("=" * 60)
    print("Fix Truncated Spanish TTS Segments")
    print("=" * 60)
    print(f"  Segments to fix: {len(PROBLEM_IDS)}")
    print(f"  Max retries: {MAX_RETRIES}")
    print(f"  cfg_weight: {RETRY_TTS_PARAMS['cfg_weight']} (up from {TTS_PARAMS['cfg_weight']})")

    # Load segment data
    with open(SEGMENTS_PATH) as f:
        all_segments = json.load(f)["segments"]
    seg_map = {s["id"]: s for s in all_segments}

    target_segments = [seg_map[sid] for sid in PROBLEM_IDS if sid in seg_map]
    missing = [sid for sid in PROBLEM_IDS if sid not in seg_map]
    if missing:
        print(f"  WARNING: {len(missing)} IDs not found in segments_es.json: {missing}")

    if args.dry_run:
        print(f"\n  Would regenerate {len(target_segments)} segments (dry run)")
        for seg in target_segments:
            tts = seg.get("tts", {}).get("text", "")[:80]
            print(f"    {seg['id']}: {tts}...")
        return

    # Load models
    print(f"\nLoading ChatterboxMultilingualTTS on {args.device}...")
    t0 = time.time()
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    tts_model = ChatterboxMultilingualTTS.from_pretrained(device=args.device)
    sample_rate = tts_model.sr
    print(f"  Loaded in {time.time() - t0:.1f}s (sr={sample_rate})")

    print(f"Loading Whisper base on {args.device}...")
    t0 = time.time()
    import stable_whisper
    whisper_model = stable_whisper.load_model("base", device=args.device)
    print(f"  Loaded in {time.time() - t0:.1f}s")

    # Process each segment with retry loop
    WAV_DIR.mkdir(parents=True, exist_ok=True)

    results = {"passed": [], "failed": [], "retries": 0}
    alignment_data = load_json(ALIGNMENT_PATH) or {}
    t_start = time.time()

    for i, seg in enumerate(target_segments):
        seg_id = seg["id"]
        tts_text = seg["tts"]["text"].strip()
        wav_path = WAV_DIR / f"{seg_id}.wav"

        print(f"\n[{i+1}/{len(target_segments)}] {seg_id} ({len(tts_text)} chars)")

        success = False
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                t0 = time.time()
                wav_tensor = tts_model.generate(
                    tts_text,
                    language_id="es",
                    audio_prompt_path=str(VOICE_PATH),
                    **RETRY_TTS_PARAMS,
                )

                if isinstance(wav_tensor, torch.Tensor):
                    audio_np = wav_tensor.squeeze().cpu().numpy()
                else:
                    audio_np = np.array(wav_tensor).squeeze()
                del wav_tensor
                cleanup_tts_memory(tts_model)

                audio_np = trim_tts_output(audio_np, sample_rate,
                                           text_len=len(tts_text), lang="es")

                sf.write(str(wav_path), audio_np, sample_rate)
                dur_ms = int(len(audio_np) / sample_rate * 1000)
                gen_time = time.time() - t0

                # Align and check for stacking
                words = align_segment(whisper_model, wav_path, tts_text)
                stacked = has_stacked_words(words)

                if stacked == 0:
                    print(f"  Attempt {attempt}: PASS ({dur_ms}ms, {len(words)}w, {gen_time:.1f}s)")
                    alignment_data[seg_id] = {
                        "words": words,
                        "word_count": len(words),
                    }
                    results["passed"].append(seg_id)
                    success = True
                    break
                else:
                    print(f"  Attempt {attempt}: STACKED ({stacked}w at end, {dur_ms}ms) — retrying")
                    results["retries"] += 1

            except Exception as e:
                print(f"  Attempt {attempt}: ERROR — {e}")
                results["retries"] += 1

        if not success:
            print(f"  FAILED after {MAX_RETRIES} attempts")
            results["failed"].append(seg_id)

    # Save alignment
    save_json_atomic(alignment_data, ALIGNMENT_PATH)

    # Free GPU models
    del tts_model, whisper_model
    gc.collect()
    torch.cuda.empty_cache()

    # Master + encode passed segments
    print(f"\nMastering {len(results['passed'])} segments...")
    mastered = 0
    for seg_id in results["passed"]:
        wav_path = WAV_DIR / f"{seg_id}.wav"
        m4a_path = AUDIO_DIR / f"{seg_id}.m4a"
        try:
            master_one_segment(str(wav_path), str(m4a_path), TARGET_LUFS, TARGET_TP)
            mastered += 1
        except Exception as e:
            print(f"  [{seg_id}] MASTER ERROR: {e}")

    # Update manifest
    print("Updating audio manifest...")
    manifest = load_json(MANIFEST_PATH)
    if manifest is None:
        print("  ERROR: audio_manifest_es.json not found!")
        return

    updated = 0
    for seg_id in results["passed"]:
        seg = seg_map[seg_id]
        wav_path = WAV_DIR / f"{seg_id}.wav"
        m4a_path = AUDIO_DIR / f"{seg_id}.m4a"

        if not m4a_path.exists():
            continue

        duration_ms = 0
        if wav_path.exists():
            try:
                info = sf.info(str(wav_path))
                duration_ms = int(info.duration * 1000)
            except Exception:
                pass

        align_entry = alignment_data.get(seg_id, {})
        words = align_entry.get("words", [])
        for w in words:
            w["word"] = fix_tts_word(w["word"])

        pause_after_ms = seg.get("tts", {}).get("pause_after_ms", 800)

        manifest["segments"][seg_id] = {
            "file": f"audio/es/{seg_id}.m4a",
            "duration_ms": duration_ms,
            "pause_after_ms": pause_after_ms,
            "words": words,
        }
        updated += 1

    save_json_atomic(manifest, MANIFEST_PATH)

    # Summary
    total_elapsed = time.time() - t_start
    print(f"\n{'=' * 60}")
    print(f"DONE in {total_elapsed/60:.1f} minutes")
    print(f"  Passed:    {len(results['passed'])}/{len(target_segments)}")
    print(f"  Failed:    {len(results['failed'])}/{len(target_segments)}")
    print(f"  Retries:   {results['retries']}")
    print(f"  Mastered:  {mastered}")
    print(f"  Manifest:  {updated} updated ({len(manifest['segments'])} total)")

    if results["failed"]:
        print(f"\n  FAILED segments (need manual attention):")
        for sid in results["failed"]:
            print(f"    {sid}")

    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
