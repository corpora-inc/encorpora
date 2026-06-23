"""Pre-master the May-8 reference WAVs and re-generate Chatterbox samples
to test whether boosting / EQing / loudness-normalizing the speaker
reference before Chatterbox improves the output.

Three variants per voice:
  - raw        (already generated in samples/<voice>/en.wav by audition script)
  - peaknorm   (peak normalize to -1 dBFS, otherwise untouched)
  - mastered   (full production filter chain: HPF + denoise + gate + compressor +
                limiter + LUFS to -22)

Outputs the variant reference WAVs under voices/data/pre-mastered/ and the
Chatterbox EN samples under voices/data/samples/<voice>-<variant>/en.wav so
direct A/B with samples/<voice>/en.wav works.
"""
from __future__ import annotations

import subprocess
import time
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

VOICES_DIR = Path("/home/skyl/encorpora/voices/data")
PREMASTER_DIR = VOICES_DIR / "pre-mastered"
SAMPLES_DIR = VOICES_DIR / "samples"

TEXT_EN = "The mountain stood tall above the valley, and the river flowed quietly through the trees."

# (narrator_slug, reference_wav_filename)
REFS: list[tuple[str, str]] = [
    ("ryan",       "ryan-baseball.wav"),
    ("isabelle-1", "isabelle-gymnastic-1.wav"),
    ("avery",      "avery-cheer-1.wav"),
]

CFG_WEIGHT = 0.85
TARGET_PEAK_DBFS = -1.0
TARGET_LUFS = -22.0
TARGET_TP_DBFS = -3.0


def peak_normalize(in_path: Path, out_path: Path) -> None:
    """Simple peak normalize to -1 dBFS. Multi-channel preserved."""
    audio, sr = sf.read(str(in_path), always_2d=False)
    peak = float(np.max(np.abs(audio)))
    if peak <= 0:
        sf.write(str(out_path), audio, sr)
        return
    target_peak = 10 ** (TARGET_PEAK_DBFS / 20)
    gain = target_peak / peak
    out = audio * gain
    sf.write(str(out_path), out, sr)
    print(f"    peaknorm: peak={20*np.log10(peak):+.2f}dBFS -> gain={20*np.log10(gain):+.2f}dB")


def full_master(in_path: Path, out_path: Path) -> None:
    """Apply the production-equivalent filter chain via ffmpeg, mirroring
    narration.yaml filter_chain settings, then loudnorm to TARGET_LUFS."""
    # Two-pass: filter chain to a tmp WAV, then loudnorm to target_lufs.
    # ffmpeg's loudnorm in single-pass approximation is fine for our purposes
    # (we're not trying to perfectly hit LUFS, just bring it into the same
    # neighborhood as the production output target).
    filters = ",".join([
        "highpass=f=80:width_type=q:width=0.7",
        # adeclick — use ffmpeg's built-in
        "adeclick=window=55:overlap=75:threshold=1.5",
        "afftdn=nr=15:nf=-35:tn=1",
        "agate=threshold=0.018:range=0.01:attack=5:release=50",
        "acompressor=threshold=0.1:ratio=2:attack=10:release=100:makeup=1",
        f"loudnorm=I={TARGET_LUFS}:TP={TARGET_TP_DBFS}:LRA=11",
        "alimiter=limit=0.708:level=disabled",
    ])
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-i", str(in_path),
        "-filter:a", filters,
        "-ar", "48000", "-c:a", "pcm_s24le",
        str(out_path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"    ffmpeg FAILED:\n{res.stderr}")
        raise SystemExit(2)
    # Report integrated LUFS of the result for visibility
    audio, sr = sf.read(str(out_path), always_2d=False)
    if audio.ndim > 1:
        meter_audio = audio.mean(axis=1)
    else:
        meter_audio = audio
    meter = pyln.Meter(sr)
    try:
        lufs = meter.integrated_loudness(meter_audio)
        print(f"    mastered: integrated LUFS={lufs:+.2f}")
    except Exception as exc:
        print(f"    mastered: LUFS measure failed ({exc})")


def generate_sample(model: ChatterboxMultilingualTTS, ref: Path, out: Path) -> tuple[float, float]:
    out.parent.mkdir(parents=True, exist_ok=True)
    t = time.time()
    wav = model.generate(
        text=TEXT_EN,
        language_id="en",
        audio_prompt_path=str(ref),
        cfg_weight=CFG_WEIGHT,
    )
    gen_s = time.time() - t
    wav_np = wav.detach().cpu().squeeze().numpy()
    sf.write(str(out), wav_np, model.sr, subtype="PCM_16")
    dur_s = wav_np.shape[-1] / model.sr
    return dur_s, gen_s


def main() -> None:
    PREMASTER_DIR.mkdir(parents=True, exist_ok=True)

    print("=== Stage 1: pre-master the reference WAVs ===")
    variants_per_voice: dict[str, list[tuple[str, Path]]] = {}
    for slug, ref_filename in REFS:
        ref = VOICES_DIR / ref_filename
        stem = ref.stem  # e.g. ryan-baseball
        peaknorm_out = PREMASTER_DIR / f"{stem}__peaknorm.wav"
        mastered_out = PREMASTER_DIR / f"{stem}__mastered.wav"
        print(f"  {slug}: {ref_filename}")
        peak_normalize(ref, peaknorm_out)
        full_master(ref, mastered_out)
        variants_per_voice[slug] = [
            ("peaknorm", peaknorm_out),
            ("mastered", mastered_out),
        ]

    print("\n=== Stage 2: Chatterbox samples for each variant ===")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  device={device}  cfg_weight={CFG_WEIGHT}")
    t0 = time.time()
    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    print(f"  model loaded in {time.time() - t0:.1f}s  sr={model.sr}\n")

    for slug, variants in variants_per_voice.items():
        for vname, vpath in variants:
            sample_out = SAMPLES_DIR / f"{slug}-{vname}" / "en.wav"
            dur_s, gen_s = generate_sample(model, vpath, sample_out)
            rtf = gen_s / dur_s if dur_s > 0 else float("nan")
            print(f"  {slug}-{vname:<9} dur={dur_s:5.2f}s gen={gen_s:5.2f}s RTF={rtf:.2f} -> {sample_out}")

    print(f"\ndone  total={time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
