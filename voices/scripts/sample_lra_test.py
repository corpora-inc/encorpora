"""Master the 3 audition refs at -18 LUFS / -1 dBTP / LRA=10 and run
Chatterbox EN samples so we can A/B against the prior -18/-1/LRA=11
samples already in /samples/<voice>-mastered-18/en.wav.

Output:
  voices/data/pre-mastered/<name>__mastered-18-lra10.wav
  voices/data/samples/<voice>-mastered-18-lra10/en.wav
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

AUDITION_VOICES: list[tuple[str, str]] = [
    ("ryan",       "ryan-baseball.wav"),
    ("isabelle-1", "isabelle-gymnastic-1.wav"),
    ("avery",      "avery-cheer-1.wav"),
]

CFG_WEIGHT = 0.85
TARGET_LUFS = -18.0
TARGET_TP = -1.0
LRA = 10.0
HPF_HZ = 80


def master(in_path: Path, out_path: Path) -> None:
    filters = ",".join([
        f"highpass=f={HPF_HZ}:width_type=q:width=0.7",
        "adeclick=window=55:overlap=75:threshold=1.5",
        "afftdn=nr=15:nf=-35:tn=1",
        "agate=threshold=0.018:range=0.01:attack=5:release=50",
        "acompressor=threshold=0.1:ratio=2:attack=10:release=100:makeup=1",
        f"loudnorm=I={TARGET_LUFS}:TP={TARGET_TP}:LRA={LRA}",
        f"alimiter=limit={10 ** (TARGET_TP / 20):.4f}:level=disabled",
    ])
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-i", str(in_path), "-filter:a", filters,
        "-ar", "48000", "-c:a", "pcm_s24le",
        str(out_path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"ffmpeg failed on {in_path.name}:\n{res.stderr}")


def main() -> None:
    PREMASTER_DIR.mkdir(parents=True, exist_ok=True)

    print(f"=== Master 3 audition refs at I={TARGET_LUFS} TP={TARGET_TP} LRA={LRA} HPF={HPF_HZ}Hz ===")
    variants: list[tuple[str, Path]] = []
    for slug, ref_filename in AUDITION_VOICES:
        ref = VOICES_DIR / ref_filename
        stem = ref.stem
        out = PREMASTER_DIR / f"{stem}__mastered-18-lra10.wav"
        master(ref, out)
        print(f"  {slug}: {out.name}")
        variants.append((slug, out))

    print(f"\n=== Chatterbox EN samples ===")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  device={device}  cfg_weight={CFG_WEIGHT}")
    t0 = time.time()
    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    print(f"  model loaded in {time.time() - t0:.1f}s  sr={model.sr}\n")

    for slug, ref_path in variants:
        out = SAMPLES_DIR / f"{slug}-mastered-18-lra10" / "en.wav"
        out.parent.mkdir(parents=True, exist_ok=True)
        t = time.time()
        wav = model.generate(
            text=TEXT_EN, language_id="en",
            audio_prompt_path=str(ref_path),
            cfg_weight=CFG_WEIGHT,
        )
        gen_s = time.time() - t
        wav_np = wav.detach().cpu().squeeze().numpy()
        sf.write(str(out), wav_np, model.sr, subtype="PCM_16")
        dur_s = wav_np.shape[-1] / model.sr
        rtf = gen_s / dur_s if dur_s > 0 else float("nan")
        print(f"  {slug}-mastered-18-lra10  dur={dur_s:5.2f}s gen={gen_s:5.2f}s RTF={rtf:.2f} -> {out}")

    print(f"\ndone  total={time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
