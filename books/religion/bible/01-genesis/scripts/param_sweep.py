#!/usr/bin/env python3
"""Systematic parameter sweep for Hebrew TTS voice comparison.

Varies one parameter at a time while holding others at baseline.
Produces an organized directory of WAV files for A/B listening.

Output structure:
  voice-comparison/he/param-sweep/{voice}/{param}_{value}/{seg_id}.wav

Parameters swept:
  cfg_weight:   [0.4, 0.6, 0.8, 1.0]  — prompt adherence (low→strict)
  exaggeration: [0.0, 0.3, 0.6, 1.0]  — expressiveness (flat→dramatic)
  temperature:  [0.2, 0.4, 0.6, 0.9]  — randomness (frozen→creative)
"""

import json
import time
import warnings
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

# Suppress noise
warnings.filterwarnings("ignore")
import logging
logging.getLogger("chatterbox").setLevel(logging.ERROR)

# Patch Llama attention
import chatterbox.models.t3.llama_configs as _llama_cfg
_llama_cfg.LLAMA_520M_CONFIG_DICT["attn_implementation"] = "eager"

VOICE_DIR = Path("/home/skyl/encorpora/voices/data")
VOICES = {
    "V2-spanish-loud": VOICE_DIR / "ian-new-narration-spanish-loud.wav",
    "V3-chinese":      VOICE_DIR / "ian-new-narration-try-chinese.wav",
    "V4-chill-clear":  VOICE_DIR / "ian-new-narration-try-more-chill-clear.wav",
    "V5-flo-english":  VOICE_DIR / "flo-new-english.wav",
    "V6-flo-spanish":  VOICE_DIR / "flo-new-spanish.wav",
}

# Test segments: medium verse, problematic short verse, longer verse
TEST_IDS = ["ch01-001", "ch01-003", "ch01-004"]

# Baseline params (held constant when not being swept)
BASELINE = {
    "cfg_weight": 0.8,
    "exaggeration": 0.3,
    "temperature": 0.6,
    "top_p": 0.85,
    "min_p": 0.10,
    "repetition_penalty": 2.5,
}

# Parameter sweep levels
SWEEPS = {
    "cfg":  ("cfg_weight",   [0.4, 0.6, 0.8, 1.0]),
    "exag": ("exaggeration", [0.0, 0.3, 0.6, 1.0]),
    "temp": ("temperature",  [0.2, 0.4, 0.6, 0.9]),
}


def main():
    pack_dir = Path("/home/skyl/encorpora/books/bible/01-genesis/pack")
    output_base = pack_dir / "audio" / "voice-comparison" / "he" / "param-sweep"

    # Load test segments
    with open(pack_dir / "segments.json") as f:
        data = json.load(f)
    seg_lookup = {s["id"]: s for s in data["segments"]}
    test_segs = [(sid, seg_lookup[sid]["tts"]["text"]) for sid in TEST_IDS]

    # Build job list: (voice, param_label, params_dict, seg_id, tts_text, wav_path)
    jobs = []
    for voice_name in VOICES:
        for sweep_label, (param_name, levels) in SWEEPS.items():
            for level in levels:
                params = dict(BASELINE)
                params[param_name] = level
                dir_name = f"{sweep_label}_{level}"
                for seg_id, tts_text in test_segs:
                    wav_path = output_base / voice_name / dir_name / f"{seg_id}.wav"
                    jobs.append((voice_name, dir_name, params, seg_id, tts_text, wav_path))

    # Deduplicate: baseline appears in all 3 sweeps
    seen = set()
    unique_jobs = []
    for job in jobs:
        key = (job[0], str(job[2]), job[3])  # voice, params, seg_id
        if key not in seen:
            seen.add(key)
            unique_jobs.append(job)
    jobs = unique_jobs

    # Count skippable
    already = sum(1 for j in jobs if j[5].exists())
    todo = len(jobs) - already

    print(f"Hebrew TTS Parameter Sweep")
    print(f"{'='*60}")
    print(f"  Voices:     {len(VOICES)}")
    print(f"  Segments:   {len(test_segs)}")
    print(f"  Sweeps:     {len(SWEEPS)} params x 4 levels each")
    print(f"  Total jobs: {len(jobs)} ({already} exist, {todo} to generate)")
    print()
    for sid, text in test_segs:
        print(f"  {sid}: {text[:65]}...")
    print()
    for label, (pname, levels) in SWEEPS.items():
        print(f"  {label} ({pname}): {levels}")
    print()

    if todo == 0:
        print("All samples already exist. Delete output dir to regenerate.")
        return

    # Load model
    print(f"Loading ChatterboxMultilingualTTS on cuda...")
    t0 = time.time()
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    model = ChatterboxMultilingualTTS.from_pretrained(device="cuda")
    sr = model.sr
    print(f"Model loaded in {time.time() - t0:.1f}s (sr={sr})\n")

    count = 0
    errors = 0
    t_start = time.time()

    for voice_name, dir_name, params, seg_id, tts_text, wav_path in jobs:
        count += 1

        if wav_path.exists():
            continue

        wav_path.parent.mkdir(parents=True, exist_ok=True)
        voice_path = str(VOICES[voice_name])

        elapsed = time.time() - t_start
        rate = count / max(elapsed, 1)
        eta = (todo - (count - already)) / max(rate, 0.01)

        print(f"[{count}/{len(jobs)}] {voice_name}/{dir_name}/{seg_id} "
              f"(ETA {eta/60:.0f}min)")

        t0 = time.time()
        try:
            wav_tensor = model.generate(
                tts_text,
                language_id="he",
                audio_prompt_path=voice_path,
                **params,
            )
            if isinstance(wav_tensor, torch.Tensor):
                audio = wav_tensor.squeeze().cpu().numpy()
            else:
                audio = np.array(wav_tensor).squeeze()

            dur_s = len(audio) / sr
            gen_s = time.time() - t0
            sf.write(str(wav_path), audio, sr)
            print(f"       {dur_s:.1f}s audio in {gen_s:.1f}s")

        except Exception as e:
            print(f"       ERROR: {e}")
            errors += 1

    del model
    torch.cuda.empty_cache()

    elapsed = time.time() - t_start
    print(f"\n{'='*60}")
    print(f"Done! {todo} samples in {elapsed:.0f}s ({elapsed/60:.1f}min)")
    if errors:
        print(f"  Errors: {errors}")

    # Print summary table
    print(f"\n{'='*60}")
    print(f"RESULTS — durations (seconds)")
    print(f"{'='*60}")

    for sweep_label, (param_name, levels) in SWEEPS.items():
        print(f"\n  {param_name}:")
        header = f"  {'voice':22s}"
        for level in levels:
            for sid in TEST_IDS:
                header += f" {sid[-3:]}@{level}"
        # Too wide — print per-segment instead
        for sid in TEST_IDS:
            print(f"\n    {sid}:")
            row = f"    {'':22s}"
            for level in levels:
                row += f"  {sweep_label}={level!s:>4s}"
            print(row)

            for voice_name in VOICES:
                row = f"    {voice_name:22s}"
                for level in levels:
                    dir_name = f"{sweep_label}_{level}"
                    wav = output_base / voice_name / dir_name / f"{sid}.wav"
                    if wav.exists():
                        import subprocess
                        probe = subprocess.run(
                            ["ffprobe", "-v", "quiet", "-show_entries",
                             "format=duration", "-of", "csv=p=0", str(wav)],
                            capture_output=True, text=True, timeout=5,
                        )
                        dur = float(probe.stdout.strip())
                        row += f"  {dur:5.1f}s"
                    else:
                        row += f"    N/A"
                print(row)


if __name__ == "__main__":
    main()
