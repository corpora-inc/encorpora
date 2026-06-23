"""Generate EN-only voice clone audition samples for the May-8 batch.

Same content as sample_august.py / sample_sky.py so the EN samples are
directly A/B-comparable against the canonical narrators.

Output: /home/skyl/encorpora/voices/data/samples/<narrator>/en.wav
"""
from __future__ import annotations

import time
from pathlib import Path

import soundfile as sf
import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

VOICES_DIR = Path("/home/skyl/encorpora/voices/data")
SAMPLES_DIR = VOICES_DIR / "samples"

# Same EN content as sample_august.py for apples-to-apples A/B.
TEXT_EN = "The mountain stood tall above the valley, and the river flowed quietly through the trees."

# (narrator_slug, reference_wav_filename)
NARRATORS: list[tuple[str, str]] = [
    ("ryan",       "ryan-baseball.wav"),
    ("isabelle-1", "isabelle-gymnastic-1.wav"),
    ("isabelle-2", "isabelle-gymnastic-2.wav"),
    ("avery",      "avery-cheer-1.wav"),
]

CFG_WEIGHT = 0.85  # memory baseline


def main() -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"device={device}  cfg_weight={CFG_WEIGHT}")

    t0 = time.time()
    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    print(f"model loaded in {time.time() - t0:.1f}s  sr={model.sr}\n")

    for slug, ref_filename in NARRATORS:
        ref = VOICES_DIR / ref_filename
        if not ref.exists():
            print(f"  [skip] {slug}: reference {ref} not found")
            continue

        out_dir = SAMPLES_DIR / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        out = out_dir / "en.wav"

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
        rtf = gen_s / dur_s if dur_s > 0 else float("nan")
        print(f"  {slug:<11} ref={ref_filename:<30} dur={dur_s:5.2f}s gen={gen_s:5.2f}s RTF={rtf:.2f} -> {out}")

    print(f"\ndone  total={time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
