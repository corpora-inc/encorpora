"""Master EVERY reference WAV in voices/data/ at TWO loudness targets,
storing variants alongside raw originals in voices/data/pre-mastered/.

Also re-runs Chatterbox EN samples on the 3 new audition voices
(Ryan, Isabelle-1, Avery) at the louder target so we can A/B
against the existing -22 LUFS / -3 TP variant.

Targets:
  - mastered-22:  -22 LUFS / -3 dBTP   (current production)
  - mastered-18:  -18 LUFS / -1 dBTP   (louder, mobile-first audiobook/podcast hybrid)

Keeps raw originals at /voices/data/<name>.wav untouched.
"""
from __future__ import annotations

import subprocess
import time
from pathlib import Path

import soundfile as sf
import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

VOICES_DIR = Path("/home/skyl/encorpora/voices/data")
PREMASTER_DIR = VOICES_DIR / "pre-mastered"
SAMPLES_DIR = VOICES_DIR / "samples"

TEXT_EN = "The mountain stood tall above the valley, and the river flowed quietly through the trees."

# (slug used in samples/, top-level reference filename)
AUDITION_VOICES: list[tuple[str, str]] = [
    ("ryan",       "ryan-baseball.wav"),
    ("isabelle-1", "isabelle-gymnastic-1.wav"),
    ("avery",      "avery-cheer-1.wav"),
]

CFG_WEIGHT = 0.85

# (target_label, target_lufs, target_tp)
TARGETS: list[tuple[str, float, float]] = [
    ("mastered-22", -22.0, -3.0),
    ("mastered-18", -18.0, -1.0),
]


def master_with_chain(in_path: Path, out_path: Path, target_lufs: float, target_tp: float) -> None:
    """Apply ttsctl-equivalent filter chain + loudnorm to a specific LUFS/TP."""
    filters = ",".join([
        "highpass=f=80:width_type=q:width=0.7",
        "adeclick=window=55:overlap=75:threshold=1.5",
        "afftdn=nr=15:nf=-35:tn=1",
        "agate=threshold=0.018:range=0.01:attack=5:release=50",
        "acompressor=threshold=0.1:ratio=2:attack=10:release=100:makeup=1",
        f"loudnorm=I={target_lufs}:TP={target_tp}:LRA=11",
        # Limiter ceiling matches the chosen TP — convert TP dBFS to linear.
        # e.g. -3 dBTP -> 0.708 ; -1 dBTP -> 0.891.
        f"alimiter=limit={10 ** (target_tp / 20):.4f}:level=disabled",
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
        raise RuntimeError(f"ffmpeg failed on {in_path.name}:\n{res.stderr}")


def main() -> None:
    PREMASTER_DIR.mkdir(parents=True, exist_ok=True)

    # ---- Stage 1: master every top-level *.wav in voices/data/ -----------
    print("=== Stage 1: master all reference WAVs at both targets ===")
    raw_refs = sorted(VOICES_DIR.glob("*.wav"))
    print(f"  found {len(raw_refs)} raw reference WAVs")

    for ref in raw_refs:
        stem = ref.stem
        for label, lufs, tp in TARGETS:
            out = PREMASTER_DIR / f"{stem}__{label}.wav"
            master_with_chain(ref, out, lufs, tp)
        print(f"  {ref.name}: mastered at -22 and -18")

    # ---- Stage 2: Chatterbox EN samples for the 3 audition voices --------
    # The -22 LUFS samples already exist at samples/<voice>-mastered/en.wav.
    # Generate the -18 LUFS samples at samples/<voice>-mastered-18/en.wav.
    print("\n=== Stage 2: Chatterbox EN samples on the louder (-18 LUFS) variant ===")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  device={device}  cfg_weight={CFG_WEIGHT}")
    t0 = time.time()
    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    print(f"  model loaded in {time.time() - t0:.1f}s  sr={model.sr}\n")

    for slug, ref_filename in AUDITION_VOICES:
        stem = Path(ref_filename).stem
        ref_18 = PREMASTER_DIR / f"{stem}__mastered-18.wav"
        out = SAMPLES_DIR / f"{slug}-mastered-18" / "en.wav"
        out.parent.mkdir(parents=True, exist_ok=True)
        t = time.time()
        wav = model.generate(
            text=TEXT_EN,
            language_id="en",
            audio_prompt_path=str(ref_18),
            cfg_weight=CFG_WEIGHT,
        )
        gen_s = time.time() - t
        wav_np = wav.detach().cpu().squeeze().numpy()
        sf.write(str(out), wav_np, model.sr, subtype="PCM_16")
        dur_s = wav_np.shape[-1] / model.sr
        rtf = gen_s / dur_s if dur_s > 0 else float("nan")
        print(f"  {slug}-mastered-18  dur={dur_s:5.2f}s gen={gen_s:5.2f}s RTF={rtf:.2f} -> {out}")

    print(f"\ndone  total={time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
