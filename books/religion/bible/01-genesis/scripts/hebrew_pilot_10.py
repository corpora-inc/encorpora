#!/usr/bin/env python3
"""Hebrew 10-segment pilot — generate TTS + align + validate for 10 test segments.

Uses ttsctl engine directly to avoid running all 1583 segments.
After this, run: ttsctl master <pack> --lang he --segments <ids>
"""

import json
import logging
import time
from pathlib import Path

import numpy as np
import soundfile as sf

from ttsctl.config import NarrationConfig, TTSParams, segments_file
from ttsctl.tts_engine import load_tts_model, generate_segment, cleanup_tts_memory

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

PACK_DIR = Path("/home/skyl/encorpora/books/bible/01-genesis/pack")
PILOT_IDS = [
    "ch01-001", "ch01-003", "ch05-024", "ch12-001", "ch22-001",
    "ch28-012", "ch35-010", "ch42-001", "ch49-001", "ch50-026",
]


def main():
    narration = NarrationConfig.load(PACK_DIR)
    params = narration.tts

    log.info("cfg_weight=%.2f (validated by Pydantic, max 1.0)", params.cfg_weight)

    # Load segments
    seg_path = segments_file(PACK_DIR, "he")
    with open(seg_path) as f:
        all_segs = {s["id"]: s for s in json.load(f)["segments"]}

    pilot_segs = [(sid, all_segs[sid]) for sid in PILOT_IDS if sid in all_segs]
    missing = [sid for sid in PILOT_IDS if sid not in all_segs]
    if missing:
        log.warning("Missing segment IDs: %s", missing)

    log.info("Pilot: %d segments, cfg_weight=%.2f", len(pilot_segs), params.cfg_weight)

    # Prepare dirs
    wav_dir = PACK_DIR / "audio" / "he" / "wav"
    wav_dir.mkdir(parents=True, exist_ok=True)

    # Voice
    voice_file = narration.voices.get("he", "ian-new-narration-spanish-loud.wav")
    voice_path = str(Path.home() / "encorpora" / "voices" / "data" / voice_file)

    # Load model
    log.info("Loading TTS model on cuda...")
    t0 = time.time()
    model, sr = load_tts_model(device="cuda")
    log.info("Model loaded in %.1fs (sr=%d)", time.time() - t0, sr)

    results = {"ok": [], "fail": []}

    for i, (seg_id, seg) in enumerate(pilot_segs):
        tts_text = seg["tts"]["text"]
        wav_path = wav_dir / f"{seg_id}.wav"

        log.info("[%d/%d] %s (%d chars): %s",
                 i + 1, len(pilot_segs), seg_id, len(tts_text), tts_text[:60])

        t0 = time.time()
        try:
            audio = generate_segment(model, tts_text, "he", voice_path, params)
            dur_s = len(audio) / sr
            gen_s = time.time() - t0
            sf.write(str(wav_path), audio, sr)
            log.info("  -> %.1fs audio in %.1fs (RTF %.2f)", dur_s, gen_s, gen_s / dur_s)
            results["ok"].append(seg_id)
        except Exception as e:
            log.error("  -> FAILED: %s", e)
            results["fail"].append(seg_id)

    # Cleanup
    del model
    import gc, torch
    gc.collect()
    torch.cuda.empty_cache()

    log.info("Pilot complete: %d ok, %d failed", len(results["ok"]), len(results["fail"]))
    if results["fail"]:
        log.warning("Failed: %s", results["fail"])

    # List WAVs for mastering
    log.info("WAVs ready at: %s", wav_dir)
    log.info("Next: ttsctl master %s --lang he --segments %s",
             PACK_DIR, ",".join(results["ok"]))


if __name__ == "__main__":
    main()
