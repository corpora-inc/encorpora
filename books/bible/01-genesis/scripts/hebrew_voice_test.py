#!/usr/bin/env python3
"""Generate Hebrew voice comparison samples for Genesis 1:1-1:5.

Uses ChatterboxMultilingualTTS with all 6 voice clone references to find
the best voice for biblical Hebrew narration.
"""

import json
import time
import warnings
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

# Suppress noisy warnings
warnings.filterwarnings("ignore", message="pkg_resources is deprecated")
warnings.filterwarnings("ignore", message="Found GPU")
warnings.filterwarnings("ignore", message="LoRACompatibleLinear")
warnings.filterwarnings("ignore", message=".*sdp_kernel.*")
warnings.filterwarnings("ignore", message=".*generation flags are not valid.*")

# Patch Llama attention for multilingual model
import chatterbox.models.t3.llama_configs as _llama_cfg
_llama_cfg.LLAMA_520M_CONFIG_DICT["attn_implementation"] = "eager"

import logging
logging.getLogger("chatterbox.models.t3.inference.alignment_stream_analyzer").setLevel(logging.ERROR)

VOICE_DIR = Path("/home/skyl/encorpora/voices/data")

# All 6 Chatterbox voice clone references
VOICES = {
    "V1-ian-original":    VOICE_DIR / "ian-narration.wav",
    "V2-ian-spanish-loud": VOICE_DIR / "ian-new-narration-spanish-loud.wav",
    "V3-ian-chinese":     VOICE_DIR / "ian-new-narration-try-chinese.wav",
    "V4-ian-chill-clear": VOICE_DIR / "ian-new-narration-try-more-chill-clear.wav",
    "V5-flo-english":     VOICE_DIR / "flo-new-english.wav",
    "V6-flo-spanish":     VOICE_DIR / "flo-new-spanish.wav",
}

TTS_PARAMS = {
    "cfg_weight": 0.8,
    "exaggeration": 0.3,
    "temperature": 0.6,
    "top_p": 0.85,
    "min_p": 0.10,
    "repetition_penalty": 2.5,
}


def main():
    pack_dir = Path("/home/skyl/encorpora/books/bible/01-genesis/pack")
    output_dir = pack_dir / "audio" / "voice-comparison" / "he"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load Genesis 1:1-1:5
    with open(pack_dir / "segments.json") as f:
        data = json.load(f)

    test_ids = ["ch01-001", "ch01-002", "ch01-003", "ch01-004", "ch01-005"]
    test_segs = [s for s in data["segments"] if s["id"] in test_ids]

    print(f"Hebrew Voice Comparison — Genesis 1:1-1:5")
    print(f"{'='*60}")
    for s in test_segs:
        print(f"  {s['id']}: {s['tts']['text'][:70]}")
    print()

    # Validate voice files
    for name, path in VOICES.items():
        if not path.exists():
            raise FileNotFoundError(f"Voice file missing: {path}")
        sz = path.stat().st_size
        print(f"  {name}: {path.name} ({sz/1024/1024:.1f}MB)")

    # Load model
    print(f"\nLoading ChatterboxMultilingualTTS on cuda...")
    t0 = time.time()
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    model = ChatterboxMultilingualTTS.from_pretrained(device="cuda")
    sr = model.sr
    print(f"Model loaded in {time.time() - t0:.1f}s (sr={sr})")

    total = len(VOICES) * len(test_segs)
    count = 0
    t_start = time.time()

    for voice_name, voice_path in VOICES.items():
        vdir = output_dir / voice_name
        vdir.mkdir(parents=True, exist_ok=True)

        print(f"\n{'='*60}")
        print(f"Voice: {voice_name}")
        print(f"{'='*60}")

        for seg in test_segs:
            count += 1
            seg_id = seg["id"]
            tts_text = seg["tts"]["text"]
            wav_path = vdir / f"{seg_id}.wav"

            if wav_path.exists():
                print(f"  [{count}/{total}] {seg_id} — exists, skip")
                continue

            print(f"  [{count}/{total}] {seg_id} ({len(tts_text)} chars)")

            t0 = time.time()
            try:
                wav_tensor = model.generate(
                    tts_text,
                    language_id="he",
                    audio_prompt_path=str(voice_path),
                    **TTS_PARAMS,
                )

                if isinstance(wav_tensor, torch.Tensor):
                    audio = wav_tensor.squeeze().cpu().numpy()
                else:
                    audio = np.array(wav_tensor).squeeze()

                dur_ms = int(len(audio) / sr * 1000)
                t_gen = time.time() - t0

                sf.write(str(wav_path), audio, sr)
                print(f"    {dur_ms}ms in {t_gen:.1f}s")

            except Exception as e:
                print(f"    ERROR: {e}")

    del model
    torch.cuda.empty_cache()

    elapsed = time.time() - t_start
    print(f"\n{'='*60}")
    print(f"Done! {count} samples in {elapsed:.0f}s ({elapsed/60:.1f}min)")
    print(f"Output: {output_dir}/")
    print(f"\nListen by segment to compare voices:")
    for seg in test_segs:
        print(f"\n  {seg['id']}: {seg['tts']['text'][:50]}...")
        for vn in VOICES:
            print(f"    {vn}/  {seg['id']}.wav")


if __name__ == "__main__":
    main()
