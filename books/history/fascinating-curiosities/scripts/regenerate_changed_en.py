#!/usr/bin/env python3
"""
Regenerate English TTS audio for segments changed by PR #204 (normalize_tts_en.py).

Uses the original English ChatterboxTTS model (not multilingual).
Only regenerates segments whose tts.text differs from the previous commit.
After TTS, runs alignment + mastering for those segments only.

Usage:
    python regenerate_changed_en.py              # full pipeline
    python regenerate_changed_en.py --dry-run    # list changed segments only
"""

# ---------------------------------------------------------------------------
# Suppress noisy warnings before imports
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
import subprocess
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
    measure_loudness,
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

VOICE_PATH = VOICES_DIR / "ian-new-narration-try-more-chill-clear.wav"
SEGMENTS_PATH = PACK_DIR / "segments.json"
ALIGNMENT_PATH = PACK_DIR / "alignment_en.json"
MANIFEST_PATH = PACK_DIR / "audio_manifest_en.json"
AUDIO_DIR = PACK_DIR / "audio" / "en"
WAV_DIR = AUDIO_DIR / "wav"

# Previous commit before PR #204 normalize_tts_en.py changes
PREV_COMMIT = "dd26bd93"


# ---------------------------------------------------------------------------
# Find changed segments
# ---------------------------------------------------------------------------

def find_changed_segments() -> list[str]:
    """Compare current segments.json tts.text against pre-PR#204 commit."""
    # Load old segments from git
    result = subprocess.run(
        ["git", "show", f"{PREV_COMMIT}:books/fascinating-curiosities/"
         "01-mystery-of-monte-alban/pack/segments.json"],
        capture_output=True, text=True,
        cwd=SCRIPT_DIR.parent.parent.parent,  # encorpora root
    )
    if result.returncode != 0:
        print(f"ERROR: Could not read old segments.json from {PREV_COMMIT}")
        print(result.stderr)
        sys.exit(1)

    old_data = json.loads(result.stdout)
    old_tts = {
        s["id"]: s.get("tts", {}).get("text", "")
        for s in old_data["segments"]
    }

    # Load current segments
    with open(SEGMENTS_PATH) as f:
        new_data = json.load(f)
    new_tts = {
        s["id"]: s.get("tts", {}).get("text", "")
        for s in new_data["segments"]
    }

    # Find changed IDs
    changed = [
        sid for sid in new_tts
        if sid in old_tts and old_tts[sid] != new_tts[sid]
    ]
    return sorted(changed)


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true",
                        help="List changed segments without regenerating")
    parser.add_argument("--device", default="cuda")
    args = parser.parse_args()

    print("=" * 60)
    print("Regenerate Changed English Segments (PR #204)")
    print("=" * 60)

    # Step 1: Find changed segments
    print("\nStep 1: Finding changed segments...")
    changed_ids = find_changed_segments()
    print(f"  Found {len(changed_ids)} segments with changed tts.text")

    if not changed_ids:
        print("  Nothing to do!")
        return

    # Load current segment data for changed IDs
    with open(SEGMENTS_PATH) as f:
        all_segments = json.load(f)["segments"]
    seg_map = {s["id"]: s for s in all_segments}
    changed_segments = [seg_map[sid] for sid in changed_ids if sid in seg_map]

    if args.dry_run:
        print("\n  Changed segments:")
        for seg in changed_segments:
            tts = seg.get("tts", {}).get("text", "")[:80]
            print(f"    {seg['id']}: {tts}...")
        print(f"\n  Total: {len(changed_segments)} segments (dry run, no changes)")
        return

    # Step 2: TTS Generation with original English ChatterboxTTS
    print(f"\nStep 2: TTS Generation ({len(changed_segments)} segments)")
    print(f"  Model: ChatterboxTTS (original English)")
    print(f"  Voice: {VOICE_PATH.name}")
    print(f"  Device: {args.device}")

    from chatterbox.tts import ChatterboxTTS
    print("  Loading ChatterboxTTS...")
    t0 = time.time()
    tts_model = ChatterboxTTS.from_pretrained(device=args.device)
    print(f"  Loaded in {time.time() - t0:.1f}s")

    sample_rate = tts_model.sr  # 24000
    generated = 0
    errors = 0
    t_tts_start = time.time()

    for i, seg in enumerate(changed_segments):
        seg_id = seg["id"]
        tts_text = seg["tts"]["text"].strip()
        wav_path = WAV_DIR / f"{seg_id}.wav"

        try:
            t0 = time.time()
            wav_tensor = tts_model.generate(
                tts_text,
                audio_prompt_path=str(VOICE_PATH),
                **TTS_PARAMS,
            )

            if isinstance(wav_tensor, torch.Tensor):
                audio_np = wav_tensor.squeeze().cpu().numpy()
            else:
                audio_np = np.array(wav_tensor).squeeze()
            del wav_tensor
            cleanup_tts_memory(tts_model)

            # Trim trailing garbage
            audio_np = trim_tts_output(audio_np, sample_rate,
                                       text_len=len(tts_text), lang="en")

            sf.write(str(wav_path), audio_np, sample_rate)
            dur_ms = int(len(audio_np) / sample_rate * 1000)
            elapsed = time.time() - t0
            generated += 1

            if (i + 1) % 10 == 0 or (i + 1) == len(changed_segments):
                total_elapsed = time.time() - t_tts_start
                rate = (i + 1) / total_elapsed if total_elapsed > 0 else 0
                remaining = (len(changed_segments) - i - 1) / rate / 60 if rate > 0 else 0
                print(f"    [{i+1}/{len(changed_segments)}] {seg_id} "
                      f"({dur_ms}ms, {elapsed:.1f}s) ~{remaining:.1f}min left")

        except Exception as e:
            errors += 1
            print(f"    [{seg_id}] ERROR: {e}")
            continue

    tts_elapsed = time.time() - t_tts_start
    print(f"  TTS done: {generated} generated, {errors} errors in {tts_elapsed/60:.1f}min")

    # Free TTS model
    del tts_model
    gc.collect()
    torch.cuda.empty_cache()

    # Step 3: Forced Alignment
    print(f"\nStep 3: Forced Alignment ({generated} segments)")
    import stable_whisper
    print("  Loading Whisper base...")
    t0 = time.time()
    whisper_model = stable_whisper.load_model("base", device=args.device)
    print(f"  Loaded in {time.time() - t0:.1f}s")

    alignment_data = load_json(ALIGNMENT_PATH) or {}
    aligned = 0
    align_errors = 0
    t_align_start = time.time()

    for i, seg in enumerate(changed_segments):
        seg_id = seg["id"]
        tts_text = seg["tts"]["text"].strip()
        wav_path = WAV_DIR / f"{seg_id}.wav"

        if not wav_path.exists():
            continue

        try:
            result = whisper_model.align(str(wav_path), tts_text, language="en")
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

            alignment_data[seg_id] = {
                "words": words,
                "word_count": len(words),
            }
            aligned += 1

        except Exception as e:
            align_errors += 1
            print(f"    [{seg_id}] ALIGN ERROR: {e}")
            continue

    # Save updated alignment
    save_json_atomic(alignment_data, ALIGNMENT_PATH)
    align_elapsed = time.time() - t_align_start
    print(f"  Alignment done: {aligned} aligned, {align_errors} errors "
          f"in {align_elapsed:.1f}s")

    # Free Whisper
    del whisper_model
    gc.collect()
    torch.cuda.empty_cache()

    # Step 4: Master + Encode to M4A
    print(f"\nStep 4: Master + Encode ({aligned} segments)")
    mastered = 0
    master_errors = 0
    t_master_start = time.time()

    for seg in changed_segments:
        seg_id = seg["id"]
        wav_path = WAV_DIR / f"{seg_id}.wav"
        m4a_path = AUDIO_DIR / f"{seg_id}.m4a"

        if not wav_path.exists():
            continue

        try:
            master_one_segment(
                str(wav_path), str(m4a_path),
                TARGET_LUFS, TARGET_TP,
            )
            mastered += 1
        except Exception as e:
            master_errors += 1
            print(f"    [{seg_id}] MASTER ERROR: {e}")

    master_elapsed = time.time() - t_master_start
    print(f"  Mastering done: {mastered} mastered, {master_errors} errors "
          f"in {master_elapsed:.1f}s")

    # Step 5: Update audio manifest
    print("\nStep 5: Updating audio manifest...")
    manifest = load_json(MANIFEST_PATH)
    if manifest is None:
        print("  ERROR: audio_manifest_en.json not found!")
        return

    updated = 0
    for seg in changed_segments:
        seg_id = seg["id"]
        m4a_path = AUDIO_DIR / f"{seg_id}.m4a"
        wav_path = WAV_DIR / f"{seg_id}.wav"

        if not m4a_path.exists():
            continue

        # Get duration from WAV
        duration_ms = 0
        if wav_path.exists():
            try:
                info = sf.info(str(wav_path))
                duration_ms = int(info.duration * 1000)
            except Exception:
                pass

        # Get alignment words with TTS word corrections
        align_entry = alignment_data.get(seg_id, {})
        words = align_entry.get("words", [])
        for w in words:
            w["word"] = fix_tts_word(w["word"])

        pause_after_ms = seg.get("tts", {}).get("pause_after_ms", 800)

        manifest["segments"][seg_id] = {
            "file": f"audio/en/{seg_id}.m4a",
            "duration_ms": duration_ms,
            "pause_after_ms": pause_after_ms,
            "words": words,
        }
        updated += 1

    save_json_atomic(manifest, MANIFEST_PATH)
    print(f"  Updated {updated} entries in audio_manifest_en.json")
    print(f"  Total segments in manifest: {len(manifest['segments'])}")

    # Summary
    total_elapsed = time.time() - t_tts_start
    print(f"\n{'=' * 60}")
    print(f"DONE in {total_elapsed/60:.1f} minutes")
    print(f"  TTS:       {generated} generated")
    print(f"  Alignment: {aligned} aligned")
    print(f"  Mastering: {mastered} encoded")
    print(f"  Manifest:  {updated} updated")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
