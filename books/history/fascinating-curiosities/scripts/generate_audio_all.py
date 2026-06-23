#!/usr/bin/env python3
"""
Unified 3-phase audio generation pipeline for all languages.

Regenerates all audiobook segments (en/es/zh) using ChatterboxMultilingualTTS
with conservative parameters, keeping raw WAVs for comparison, and encoding
to m4a (AAC) exactly once with mastering + normalization baked into a single ffmpeg pass.
M4A chosen over opus for universal iOS WebView/Safari compatibility.

Architecture:
    Phase 1 (GPU): TTS → raw WAV (kept for A/B comparison)
    Phase 2 (GPU): stable-ts alignment → word timestamps
    Phase 3 (CPU): measure LUFS on WAV → apply gain + mastering + m4a encode (ONE pass)

Each phase is independently resumable. Only one GPU model loaded at a time.
Phase 3 is CPU-only and massively parallelizable.

Why single-encode matters:
    The old pipeline ran TTS → WAV → mastering → opus, then normalize_audio.py
    decoded that opus, applied volume gain, and re-encoded to opus at 48kbps.
    Each lossy encode/decode cycle introduces artifacts — two passes destroyed
    the audio. This script encodes to m4a (AAC) exactly ONCE, from the raw WAV.
    M4A is universally supported on iOS WebView/Safari, unlike opus.

Usage:
    # Run all 3 phases for all languages:
    python generate_audio_all.py all

    # Run individual phases:
    python generate_audio_all.py tts          # Phase 1 only
    python generate_audio_all.py tts --lang zh # Phase 1, Chinese only
    python generate_audio_all.py align        # Phase 2 only
    python generate_audio_all.py master       # Phase 3 only

    # Override defaults:
    python generate_audio_all.py all --device cuda --workers 10

    # Force regeneration (delete existing audio first):
    python generate_audio_all.py all --force

    # Per-language voice selection:
    python generate_audio_all.py tts --voice ian-new-narration-try-more-chill-clear.wav
    python generate_audio_all.py tts --voice-zh ian-new-narration-try-chinese.wav

Requires:
    - PyTorch cu130 (for DGX Spark GB10)
    - chatterbox-tts (with chatterbox.mtl_tts for multilingual)
    - stable-ts (Whisper-based forced alignment)
    - soundfile, numpy
    - ffmpeg (system package, for AAC/M4A encoding + LUFS measurement)
"""

# ---------------------------------------------------------------------------
# Suppress noisy upstream warnings before any imports touch them
# ---------------------------------------------------------------------------
import logging
import warnings

warnings.filterwarnings("ignore", message="pkg_resources is deprecated")
warnings.filterwarnings("ignore", message="Found GPU")
warnings.filterwarnings("ignore", message="LoRACompatibleLinear")
warnings.filterwarnings("ignore", message=".*sdp_kernel.*")
warnings.filterwarnings("ignore", message=".*generation flags are not valid.*")
logging.getLogger("chatterbox.models.t3.inference.alignment_stream_analyzer").setLevel(
    logging.ERROR
)

# Patch Llama attention BEFORE any model loading — the multilingual model's
# AlignmentStreamAnalyzer requires output_attentions=True, which is incompatible
# with SDPA. Switch to eager attention implementation.
import chatterbox.models.t3.llama_configs as _llama_cfg
_llama_cfg.LLAMA_520M_CONFIG_DICT["attn_implementation"] = "eager"

import argparse
import gc
import json
import os
import re
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
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

# Default voice per language — override with --voice or --voice-{lang} CLI args.
# After A/B comparison, update these to the best voice for each language.
DEFAULT_VOICE_PATHS = {
    "en": VOICES_DIR / "ian-new-narration-try-more-chill-clear.wav",
    "es": VOICES_DIR / "ian-new-narration-spanish-loud.wav",
    "zh": VOICES_DIR / "ian-new-narration-spanish-loud.wav",
}

LANGUAGES = ["en", "es", "zh"]

# Segments file per language (English is segments.json, others segments_{lang}.json)
SEGMENTS_FILES = {
    "en": PACK_DIR / "segments.json",
    "es": PACK_DIR / "segments_es.json",
    "zh": PACK_DIR / "segments_zh.json",
}

# Conservative TTS params — proven best via A/B comparison
TTS_PARAMS = {
    "cfg_weight": 0.8,
    "exaggeration": 0.3,
    "temperature": 0.6,
    "top_p": 0.85,
    "min_p": 0.10,
    "repetition_penalty": 2.5,
}

# Mastering target levels
TARGET_LUFS = -20.0
TARGET_TP = -3.0  # dBTP

# TTS phonetic spelling → correct display spelling.
# The TTS pipeline uses phonetic misspellings for pronunciation (e.g. "Oahaca"
# for "Oaxaca"). Whisper alignment picks these up in word entries. This map
# corrects them so manifest word entries match the display text.
TTS_WORD_CORRECTIONS = {
    "mahgay": "maguey",
    "chahpoolinehs": "chapulines",
    "molay": "mole",
    "jagwar": "jaguar",
    "Dahnsahntess": "Danzantes",
    "Meeshtek": "Mixtec",
    "Meeshteka": "Mixteca",
    "Sahpotek": "Zapotec",
    "ka": "か",
    "shan": "山",
    "Oahaca": "Oaxaca",
    "oahaqueño": "oaxaqueño",
    "Oahaqueño": "Oaxaqueño",
    "oahaqueños": "oaxaqueños",
    "Teotiguacán": "Teotihuacán",
    "teotiguacana": "teotihuacana",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def fix_tts_word(word: str) -> str:
    """Replace TTS phonetic spelling in a word entry, preserving trailing punct."""
    m = re.match(r'^(.+?)([\.\,\;\:\!\?\"\'\"\"\—\–]+)$', word)
    base, punct = (m.group(1), m.group(2)) if m else (word, "")
    if base in TTS_WORD_CORRECTIONS:
        return TTS_WORD_CORRECTIONS[base] + punct
    return word


def cleanup_tts_memory(tts_model):
    """Clean up accumulated state from ChatterboxMultilingualTTS.generate().

    The T3 model has a critical memory leak: each generate() call creates a
    new AlignmentStreamAnalyzer that registers 3 forward hooks on the
    transformer layers but NEVER removes them. After ~958 calls, 2874 stale
    hooks accumulate, each holding closure references to attention tensors,
    growing RSS by ~72MB/call until OOM.

    This function:
    1. Removes all forward hooks from T3 transformer layers
    2. Resets the compiled flag so a fresh analyzer is created next call
    3. Clears CUDA cache to reclaim fragmented memory
    """
    t3 = getattr(tts_model, "t3", None)
    if t3 is None:
        return

    # Remove all forward hooks from transformer layers to stop the leak.
    tfmr = getattr(t3, "tfmr", None)
    if tfmr is not None:
        for layer in getattr(tfmr, "layers", []):
            attn = getattr(layer, "self_attn", None)
            if attn is not None and hasattr(attn, "_forward_hooks"):
                attn._forward_hooks.clear()

    # Reset compiled flag so next generate() creates a fresh patched_model
    # with a fresh AlignmentStreamAnalyzer (and fresh hooks).
    t3.compiled = False
    if hasattr(t3, "patched_model"):
        t3.patched_model = None

    # Let Python collect any orphaned tensors, then free CUDA cache.
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def trim_tts_output(
    audio: np.ndarray, sample_rate: int,
    text_len: int, lang: str,
) -> np.ndarray:
    """Trim garbage tails from TTS output.

    Chatterbox sometimes keeps generating past real speech, producing
    loud artifacts. Two independent strategies; the shorter result wins:

    Strategy 1 — ZCR anomaly detection:
        Voiced speech has moderate ZCR; noise/babble has high ZCR. Find
        the first run of 3+ consecutive 500ms windows with ZCR > 2.5×
        the speech median. Once found, doesn't reset on brief dips.

    Strategy 2 — Text-length hard cap:
        Estimate max duration from text length and language. Applies a
        fade-out to avoid clicks. This is the primary safety net.

    Returns trimmed audio.
    """
    if len(audio) == 0:
        return audio

    # --- Strategy 1: ZCR anomaly detection ---
    window_ms = 500
    window_samples = int(sample_rate * window_ms / 1000)
    if window_samples > 0 and len(audio) > window_samples * 8:
        n_windows = len(audio) // window_samples

        zcr = np.array([
            np.sum(np.abs(np.diff(np.sign(
                audio[i * window_samples:(i + 1) * window_samples]
            )))) / 2 / (window_ms / 1000)
            for i in range(n_windows)
        ])

        # Speech reference: median ZCR of first 50%
        speech_ref_end = max(1, int(n_windows * 0.5))
        speech_zcr = np.median(zcr[:speech_ref_end])

        if speech_zcr > 0:
            scan_start = max(speech_ref_end, int(n_windows * 0.6))
            threshold = speech_zcr * 2.5
            anomaly_start = None
            consecutive = 0

            for i in range(scan_start, n_windows):
                if zcr[i] > threshold:
                    consecutive += 1
                    if consecutive >= 3 and anomaly_start is None:
                        anomaly_start = i - 2  # back up to first bad window
                else:
                    # Once anomaly is found, brief dips don't cancel it.
                    if anomaly_start is None:
                        consecutive = 0

            if anomaly_start is not None:
                buffer_samples = int(sample_rate * 0.3)
                trim_point = anomaly_start * window_samples + buffer_samples
                trim_point = min(trim_point, len(audio))
                if len(audio) - trim_point > sample_rate:
                    audio = audio[:trim_point]

    # --- Strategy 2: Text-length hard cap ---
    # Per-language max seconds/char.
    # Observed rates: zh 0.17-0.32 s/char (proper names push higher),
    # en/es ~0.06-0.10 s/char. Use generous margin to avoid clipping
    # legitimate speech while catching obviously excessive output.
    max_sec_per_char = {"en": 0.12, "es": 0.12, "zh": 0.25}
    base_buffer = {"en": 5.0, "es": 5.0, "zh": 5.0}
    rate = max_sec_per_char.get(lang, 0.12)
    buf = base_buffer.get(lang, 5.0)
    max_duration_s = text_len * rate + buf
    max_samples = int(max_duration_s * sample_rate)

    if len(audio) > max_samples:
        fade_samples = int(sample_rate * 0.05)
        audio = audio[:max_samples]
        if fade_samples > 0 and len(audio) > fade_samples:
            fade = np.linspace(1.0, 0.0, fade_samples)
            audio[-fade_samples:] *= fade

    return audio


def check_ffmpeg():
    """Verify ffmpeg is available."""
    if shutil.which("ffmpeg") is None:
        print("ERROR: ffmpeg not found. Install with: sudo apt install ffmpeg")
        sys.exit(1)


def load_segments(lang: str) -> list[dict]:
    """Load segments for a language, return list of segments with TTS text."""
    path = SEGMENTS_FILES[lang]
    with open(path, "r") as f:
        data = json.load(f)
    segments = [
        s for s in data["segments"]
        if s.get("tts", {}).get("text", "").strip()
    ]
    print(f"  [{lang}] Loaded {len(segments)} TTS segments from {path.name}")
    return segments


def save_json_atomic(data: dict, path: Path):
    """Write JSON atomically (tmp + rename)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)


def load_json(path: Path) -> dict | None:
    """Load JSON if it exists, else None."""
    if path.exists():
        with open(path, "r") as f:
            return json.load(f)
    return None


def audio_dir(lang: str) -> Path:
    return PACK_DIR / "audio" / lang


def wav_dir(lang: str) -> Path:
    return audio_dir(lang) / "wav"


def manifest_path(lang: str) -> Path:
    return PACK_DIR / f"audio_manifest_{lang}.json"


def alignment_path(lang: str) -> Path:
    return PACK_DIR / f"alignment_{lang}.json"


# ---------------------------------------------------------------------------
# Phase 1: TTS Generation
# ---------------------------------------------------------------------------


def phase_tts(langs: list[str], voice_paths: dict[str, Path],
              device: str = "cuda", force: bool = False):
    """Generate raw WAVs for all segments using ChatterboxMultilingualTTS."""
    print("\n" + "=" * 60)
    print("PHASE 1: TTS Generation")
    print("=" * 60)

    # Validate voice files
    for lang in langs:
        vp = voice_paths[lang]
        if not vp.exists():
            print(f"ERROR: Voice file not found for {lang}: {vp}")
            sys.exit(1)
        print(f"  Voice [{lang}]: {vp.name}")

    # Force mode: delete existing WAVs so everything regenerates
    if force:
        for lang in langs:
            wdir = wav_dir(lang)
            if wdir.exists():
                count = len(list(wdir.glob("*.wav")))
                if count > 0:
                    print(f"  [force] Deleting {count} existing WAVs in {wdir}")
                    shutil.rmtree(wdir)
                    wdir.mkdir(parents=True, exist_ok=True)

    # Load model once
    print(f"\nLoading ChatterboxMultilingualTTS on {device}...")
    t0 = time.time()
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    tts_model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    sample_rate = tts_model.sr
    print(f"Model loaded in {time.time() - t0:.1f}s (sr={sample_rate})")

    total_generated = 0
    total_skipped = 0
    total_errors = 0
    t_phase_start = time.time()

    for lang in langs:
        segments = load_segments(lang)
        out_dir = wav_dir(lang)
        out_dir.mkdir(parents=True, exist_ok=True)

        # Language ID for Chatterbox multilingual model
        lang_id = lang
        voice = str(voice_paths[lang])

        skipped = 0
        generated = 0
        errors = 0
        t_lang_start = time.time()

        print(f"\n  [{lang}] Generating {len(segments)} segments → {out_dir}")

        for i, seg in enumerate(segments):
            seg_id = seg["id"]
            tts_text = seg["tts"]["text"].strip()
            wav_path = out_dir / f"{seg_id}.wav"

            # Resume: skip if WAV already exists
            if wav_path.exists():
                skipped += 1
                continue

            try:
                t0 = time.time()
                wav_tensor = tts_model.generate(
                    tts_text,
                    language_id=lang_id,
                    audio_prompt_path=voice,
                    **TTS_PARAMS,
                )

                # Move output off GPU and clean up leaked model state
                if isinstance(wav_tensor, torch.Tensor):
                    audio_np = wav_tensor.squeeze().cpu().numpy()
                else:
                    audio_np = np.array(wav_tensor).squeeze()
                del wav_tensor
                cleanup_tts_memory(tts_model)

                # Trim trailing garbage from TTS output
                raw_len = len(audio_np)
                audio_np = trim_tts_output(
                    audio_np, sample_rate,
                    text_len=len(tts_text), lang=lang,
                )
                trimmed = raw_len - len(audio_np)

                sf.write(str(wav_path), audio_np, sample_rate)
                dur_ms = int(len(audio_np) / sample_rate * 1000)
                elapsed = time.time() - t0
                generated += 1

                # Progress every 25 segments
                done = skipped + generated + errors
                if done % 25 == 0 or done == len(segments):
                    total_elapsed = time.time() - t_lang_start
                    remaining_segs = len(segments) - done
                    rate = done / total_elapsed if total_elapsed > 0 else 0
                    eta = remaining_segs / rate / 60 if rate > 0 else 0
                    print(
                        f"    [{lang}] {done}/{len(segments)} "
                        f"({skipped} skipped, {generated} gen, {errors} err) "
                        f"~{eta:.0f}min left"
                    )
                else:
                    trim_info = f", trimmed {trimmed/sample_rate:.1f}s" if trimmed > 0 else ""
                    print(
                        f"    [{seg_id}] {dur_ms}ms audio in {elapsed:.1f}s "
                        f"({len(tts_text)} chars{trim_info})"
                    )

            except Exception as e:
                errors += 1
                print(f"    [{seg_id}] ERROR: {e}")
                continue

        lang_elapsed = time.time() - t_lang_start
        print(
            f"  [{lang}] Done: {generated} generated, {skipped} skipped, "
            f"{errors} errors in {lang_elapsed/60:.1f}min"
        )
        total_generated += generated
        total_skipped += skipped
        total_errors += errors

    # Free GPU memory
    del tts_model
    torch.cuda.empty_cache()

    phase_elapsed = time.time() - t_phase_start
    print(f"\nPhase 1 complete: {total_generated} generated, "
          f"{total_skipped} skipped, {total_errors} errors "
          f"in {phase_elapsed/60:.1f}min")


# ---------------------------------------------------------------------------
# Phase 2: Forced Alignment
# ---------------------------------------------------------------------------


def phase_align(langs: list[str], device: str = "cuda",
                whisper_size: str = "base", force: bool = False):
    """Run stable-ts forced alignment on all WAVs."""
    print("\n" + "=" * 60)
    print("PHASE 2: Forced Alignment")
    print("=" * 60)

    # Force mode: delete existing alignment files
    if force:
        for lang in langs:
            apath = alignment_path(lang)
            if apath.exists():
                print(f"  [force] Deleting {apath.name}")
                apath.unlink()

    print(f"\nLoading Whisper {whisper_size} on {device}...")
    t0 = time.time()
    import stable_whisper
    whisper_model = stable_whisper.load_model(whisper_size, device=device)
    print(f"Whisper loaded in {time.time() - t0:.1f}s")

    total_aligned = 0
    total_skipped = 0
    total_errors = 0
    t_phase_start = time.time()

    for lang in langs:
        segments = load_segments(lang)
        wdir = wav_dir(lang)
        apath = alignment_path(lang)

        # Load existing alignment for resume
        alignment_data = load_json(apath) or {}
        skipped = 0
        aligned = 0
        errors = 0
        t_lang_start = time.time()

        print(f"\n  [{lang}] Aligning {len(segments)} segments from {wdir}")

        for i, seg in enumerate(segments):
            seg_id = seg["id"]
            tts_text = seg["tts"]["text"].strip()
            wpath = wdir / f"{seg_id}.wav"

            # Resume: skip if already aligned
            if seg_id in alignment_data:
                skipped += 1
                continue

            if not wpath.exists():
                print(f"    [{seg_id}] WAV not found, skipping")
                errors += 1
                continue

            try:
                t0 = time.time()
                result = whisper_model.align(
                    str(wpath), tts_text, language=lang
                )

                words = []
                for segment in result.segments:
                    for word_info in segment.words:
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
                elapsed = time.time() - t0

                # Save after every segment (crash-safe)
                save_json_atomic(alignment_data, apath)

                # Progress every 50 segments
                done = skipped + aligned + errors
                if done % 50 == 0 or done == len(segments):
                    total_elapsed = time.time() - t_lang_start
                    remaining = len(segments) - done
                    rate = done / total_elapsed if total_elapsed > 0 else 0
                    eta = remaining / rate / 60 if rate > 0 else 0
                    print(
                        f"    [{lang}] {done}/{len(segments)} "
                        f"({skipped} skip, {aligned} aligned, {errors} err) "
                        f"~{eta:.0f}min left"
                    )

            except Exception as e:
                errors += 1
                print(f"    [{seg_id}] ERROR: {e}")
                continue

        lang_elapsed = time.time() - t_lang_start
        print(
            f"  [{lang}] Done: {aligned} aligned, {skipped} skipped, "
            f"{errors} errors in {lang_elapsed/60:.1f}min"
        )
        total_aligned += aligned
        total_skipped += skipped
        total_errors += errors

    # Free GPU memory
    del whisper_model
    torch.cuda.empty_cache()

    phase_elapsed = time.time() - t_phase_start
    print(f"\nPhase 2 complete: {total_aligned} aligned, "
          f"{total_skipped} skipped, {total_errors} errors "
          f"in {phase_elapsed/60:.1f}min")


# ---------------------------------------------------------------------------
# Phase 3: Master + Encode (CPU, parallel)
# ---------------------------------------------------------------------------


def measure_loudness(wav_path: str) -> dict:
    """Measure integrated LUFS and true peak using ffmpeg loudnorm analysis."""
    cmd = [
        "ffmpeg", "-hide_banner", "-y",
        "-i", wav_path,
        "-af", "loudnorm=I=-20:TP=-3:LRA=11:print_format=json",
        "-f", "null", "/dev/null",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    json_match = re.search(r'\{[^}]+\}', result.stderr, re.DOTALL)
    if not json_match:
        raise RuntimeError(f"Could not parse loudnorm output for {wav_path}")
    return json.loads(json_match.group())


def master_one_segment(
    wav_path: str, m4a_path: str,
    target_i: float, target_tp: float,
) -> dict:
    """Measure LUFS on WAV, then apply gain + mastering + m4a encode in ONE pass.

    Two ffmpeg invocations on the WAV (never on the encoded file):
        Pass 1: Measure LUFS (analysis only, no output file)
        Pass 2: Apply constant gain + mastering chain + AAC encode → .m4a
    """
    # Pass 1: Measure
    measurements = measure_loudness(wav_path)
    input_lufs = float(measurements["input_i"])
    input_tp = float(measurements["input_tp"])

    # Calculate constant gain
    gain_db = target_i - input_lufs

    # Clamp gain so projected peak stays below ceiling
    projected_peak = input_tp + gain_db
    clamped = False
    if projected_peak > target_tp:
        gain_db = target_tp - input_tp
        clamped = True

    # Pass 2: Apply gain + mastering chain + AAC encode in ONE ffmpeg call
    # Volume gain is applied BEFORE the mastering chain so the compressor/limiter
    # see correct levels. The limiter guarantees true peak stays below -3 dBTP.
    af_chain = ",".join([
        f"volume={gain_db:.2f}dB",
        "highpass=f=80:width_type=q:width=0.7",
        "adeclick=window=55:overlap=75:threshold=1.5",
        "afftdn=nr=15:nf=-35:tn=1",
        "agate=threshold=0.018:range=0.01:attack=5:release=50",
        "acompressor=threshold=0.1:ratio=2:attack=10:release=100:makeup=1",
        "alimiter=limit=0.708:level=false",
    ])

    os.makedirs(os.path.dirname(m4a_path), exist_ok=True)

    cmd = [
        "ffmpeg", "-y", "-i", wav_path,
        "-af", af_chain,
        "-c:a", "aac",
        "-b:a", "64000",
        m4a_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg encoding failed for {wav_path}: {result.stderr[:300]}"
        )

    return {
        "input_lufs": input_lufs,
        "input_tp": input_tp,
        "gain_db": gain_db,
        "clamped": clamped,
    }


def phase_master(langs: list[str], voice_paths: dict[str, Path],
                 workers: int = 10, force: bool = False):
    """Measure LUFS on WAV → apply gain + mastering + m4a encode (ONE pass)."""
    print("\n" + "=" * 60)
    print("PHASE 3: Master + Encode to M4A (single-pass, CPU parallel)")
    print("=" * 60)

    check_ffmpeg()

    # Force mode: delete existing m4a files and manifests
    if force:
        for lang in langs:
            adir = audio_dir(lang)
            m4a_files = list(adir.glob("*.m4a"))
            if m4a_files:
                print(f"  [force] Deleting {len(m4a_files)} m4a files in {adir}")
                for f in m4a_files:
                    f.unlink()
            mpath = manifest_path(lang)
            if mpath.exists():
                print(f"  [force] Deleting {mpath.name}")
                mpath.unlink()

    total_mastered = 0
    total_skipped = 0
    total_errors = 0
    all_results = []
    t_phase_start = time.time()

    for lang in langs:
        segments = load_segments(lang)
        wdir = wav_dir(lang)
        adir = audio_dir(lang)
        apath = alignment_path(lang)
        mpath = manifest_path(lang)

        # Load alignment data
        alignment_data = load_json(apath) or {}

        # Build work items: only WAVs that exist
        work = []
        skipped = 0
        for seg in segments:
            seg_id = seg["id"]
            wpath = wdir / f"{seg_id}.wav"
            opath = adir / f"{seg_id}.m4a"
            if not wpath.exists():
                skipped += 1
                continue
            work.append((seg_id, seg, str(wpath), str(opath)))

        print(f"\n  [{lang}] Mastering {len(work)} segments "
              f"({skipped} missing WAVs), {workers} workers")

        results = []
        errors = []
        t_lang_start = time.time()

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(
                    master_one_segment, wpath, m4a_path,
                    TARGET_LUFS, TARGET_TP,
                ): (seg_id, seg, wpath, m4a_path)
                for seg_id, seg, wpath, m4a_path in work
            }

            done = 0
            for future in as_completed(futures):
                done += 1
                seg_id, seg, wpath, m4a_path = futures[future]
                try:
                    r = future.result()
                    r["seg_id"] = seg_id
                    results.append(r)
                except Exception as e:
                    errors.append({"seg_id": seg_id, "error": str(e)})
                    print(f"    [{seg_id}] ERROR: {e}")

                if done % 100 == 0 or done == len(work):
                    elapsed = time.time() - t_lang_start
                    rate = done / elapsed if elapsed > 0 else 0
                    remaining = (len(work) - done) / rate / 60 if rate > 0 else 0
                    print(
                        f"    [{lang}] {done}/{len(work)} "
                        f"({len(errors)} errors) ~{remaining:.0f}min left"
                    )

        # Build manifest by merging alignment data + duration info
        voice_name = voice_paths[lang].stem  # e.g. "ian-narration"
        manifest = {
            "language": lang,
            "voice": voice_name,
            "sample_rate": 24000,  # Will be updated from WAV info
            "segments": {},
        }

        for seg in segments:
            seg_id = seg["id"]
            opath = adir / f"{seg_id}.m4a"
            if not opath.exists():
                continue

            # Get duration from WAV (more accurate than probing encoded file)
            wpath = wdir / f"{seg_id}.wav"
            duration_ms = 0
            if wpath.exists():
                try:
                    info = sf.info(str(wpath))
                    duration_ms = int(info.duration * 1000)
                    manifest["sample_rate"] = info.samplerate
                except Exception:
                    pass

            # Get alignment words, correcting TTS phonetic misspellings
            align_entry = alignment_data.get(seg_id, {})
            words = align_entry.get("words", [])
            for w in words:
                w["word"] = fix_tts_word(w["word"])

            pause_after_ms = seg.get("tts", {}).get("pause_after_ms", 800)

            manifest["segments"][seg_id] = {
                "file": f"audio/{lang}/{seg_id}.m4a",
                "duration_ms": duration_ms,
                "pause_after_ms": pause_after_ms,
                "words": words,
            }

        save_json_atomic(manifest, mpath)

        lang_elapsed = time.time() - t_lang_start
        print(
            f"  [{lang}] Done: {len(results)} mastered, {len(errors)} errors "
            f"in {lang_elapsed/60:.1f}min → {mpath.name}"
        )

        total_mastered += len(results)
        total_skipped += skipped
        total_errors += len(errors)
        all_results.extend(results)

    # Summary stats
    phase_elapsed = time.time() - t_phase_start
    if all_results:
        lufs_vals = [r["input_lufs"] for r in all_results]
        gains = [r["gain_db"] for r in all_results]
        clamped = [r for r in all_results if r["clamped"]]
        print(f"\nPhase 3 complete: {total_mastered} mastered, "
              f"{total_errors} errors in {phase_elapsed/60:.1f}min")
        print(f"  Input LUFS: avg {sum(lufs_vals)/len(lufs_vals):.1f} "
              f"(range {min(lufs_vals):.1f} to {max(lufs_vals):.1f})")
        print(f"  Gain: avg {sum(gains)/len(gains):.1f} dB "
              f"(range {min(gains):.1f} to {max(gains):.1f})")
        print(f"  Peak-clamped: {len(clamped)}/{len(all_results)} files")
    else:
        print(f"\nPhase 3 complete: nothing to process")


# ---------------------------------------------------------------------------
# Main CLI
# ---------------------------------------------------------------------------


def parse_langs(args_lang: str | None) -> list[str]:
    """Parse --lang argument into a list of language codes."""
    if args_lang is None:
        return LANGUAGES
    if args_lang == "all":
        return LANGUAGES
    langs = [l.strip() for l in args_lang.split(",")]
    for l in langs:
        if l not in LANGUAGES:
            print(f"ERROR: Unknown language '{l}'. Choose from: {LANGUAGES}")
            sys.exit(1)
    return langs


def resolve_voice_paths(args) -> dict[str, Path]:
    """Build per-language voice path dict from CLI args.

    Priority (highest to lowest):
        1. --voice-en / --voice-es / --voice-zh  (per-language override)
        2. --voice  (override all languages)
        3. DEFAULT_VOICE_PATHS  (from constants at top of file)
    """
    paths = dict(DEFAULT_VOICE_PATHS)

    # Global override
    if args.voice:
        vp = Path(args.voice)
        if not vp.is_absolute():
            vp = VOICES_DIR / vp
        for lang in LANGUAGES:
            paths[lang] = vp

    # Per-language overrides
    for lang in LANGUAGES:
        attr = f"voice_{lang}"
        val = getattr(args, attr, None)
        if val:
            vp = Path(val)
            if not vp.is_absolute():
                vp = VOICES_DIR / vp
            paths[lang] = vp

    return paths


def main():
    parser = argparse.ArgumentParser(
        description="Unified 3-phase audio generation pipeline (all languages)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python generate_audio_all.py all              # Full pipeline, all languages
  python generate_audio_all.py tts --lang zh    # TTS only, Chinese
  python generate_audio_all.py align            # Alignment only, all languages
  python generate_audio_all.py master --workers 15  # Master/encode, 15 threads
  python generate_audio_all.py all --force      # Delete old audio, regenerate all
  python generate_audio_all.py tts --voice ian-new-narration-try-more-chill-clear.wav
  python generate_audio_all.py tts --voice-zh ian-new-narration-try-chinese.wav
        """,
    )
    parser.add_argument(
        "phase",
        choices=["tts", "align", "master", "all"],
        help="Which phase(s) to run",
    )
    parser.add_argument(
        "--lang", default=None,
        help="Language(s) to process: en, es, zh, or comma-separated "
             "(default: all three)",
    )
    parser.add_argument(
        "--device", default="cuda",
        help="Device for GPU models (default: cuda)",
    )
    parser.add_argument(
        "--workers", type=int, default=10,
        help="CPU workers for Phase 3 mastering (default: 10)",
    )
    parser.add_argument(
        "--whisper-model", default="base",
        help="Whisper model size for alignment (default: base)",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Delete existing WAVs/m4a/alignments before regenerating "
             "(no resume — full redo)",
    )
    parser.add_argument(
        "--voice", default=None,
        help="Voice WAV file to use for ALL languages "
             "(filename in voices/data/ or absolute path)",
    )
    parser.add_argument(
        "--voice-en", default=None,
        help="Voice WAV override for English",
    )
    parser.add_argument(
        "--voice-es", default=None,
        help="Voice WAV override for Spanish",
    )
    parser.add_argument(
        "--voice-zh", default=None,
        help="Voice WAV override for Chinese",
    )
    args = parser.parse_args()

    langs = parse_langs(args.lang)
    voice_paths = resolve_voice_paths(args)
    check_ffmpeg()

    print(f"Pipeline: phase={args.phase}, langs={langs}, device={args.device}")
    print(f"Book: {BOOK_DIR.name}")
    if args.force:
        print(f"FORCE MODE: deleting existing audio before regenerating")
    for lang in langs:
        print(f"  Voice [{lang}]: {voice_paths[lang].name}")
    print(f"TTS params: {TTS_PARAMS}")

    t_total = time.time()

    if args.phase in ("tts", "all"):
        phase_tts(langs, voice_paths=voice_paths, device=args.device,
                  force=args.force)

    if args.phase in ("align", "all"):
        phase_align(langs, device=args.device, whisper_size=args.whisper_model,
                    force=args.force)

    if args.phase in ("master", "all"):
        phase_master(langs, voice_paths=voice_paths, workers=args.workers,
                     force=args.force)

    total_elapsed = time.time() - t_total
    print(f"\n{'=' * 60}")
    print(f"All done! Total time: {total_elapsed/60:.1f}min "
          f"({total_elapsed/3600:.1f}hr)")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
