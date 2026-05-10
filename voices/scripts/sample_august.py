"""Generate August voice samples across a representative set of Chatterbox languages.

Output: /home/skyl/encorpora/voices/data/samples/august/<lang>.wav
"""
from __future__ import annotations

import time
from pathlib import Path

import soundfile as sf
import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

REF_WAV = Path("/home/skyl/encorpora/voices/data/august-20.wav")
OUT_DIR = Path("/home/skyl/encorpora/voices/data/samples/august")

# Same content across all languages so the comparison is apples-to-apples.
SAMPLES: dict[str, str] = {
    "en": "The mountain stood tall above the valley, and the river flowed quietly through the trees.",
    "es": "La montaña se alzaba alta sobre el valle, y el río corría tranquilo entre los árboles.",
    "fr": "La montagne se dressait haute au-dessus de la vallée, et la rivière coulait tranquillement à travers les arbres.",
    "de": "Der Berg ragte hoch über das Tal, und der Fluss strömte leise durch die Bäume.",
    "ru": "Гора возвышалась над долиной, а река тихо текла среди деревьев.",
    "ar": "كان الجبل شامخًا فوق الوادي، والنهر يجري بهدوء بين الأشجار.",
    "he": "ההר התנשא גבוה מעל העמק, והנהר זרם בשקט בין העצים.",
    "zh": "高山耸立在山谷之上，河水静静地流过林间。",
}

CFG_WEIGHT = 0.85  # memory baseline


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"device={device}  ref={REF_WAV.name}  cfg_weight={CFG_WEIGHT}")

    t0 = time.time()
    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    print(f"model loaded in {time.time() - t0:.1f}s  sr={model.sr}")

    for lang, text in SAMPLES.items():
        out = OUT_DIR / f"{lang}.wav"
        t = time.time()
        wav = model.generate(
            text=text,
            language_id=lang,
            audio_prompt_path=str(REF_WAV),
            cfg_weight=CFG_WEIGHT,
        )
        gen_s = time.time() - t
        wav_np = wav.detach().cpu().squeeze().numpy()  # mono float32
        sf.write(str(out), wav_np, model.sr, subtype="PCM_16")
        dur_s = wav_np.shape[-1] / model.sr
        rtf = gen_s / dur_s if dur_s > 0 else float("nan")
        print(f"  {lang}: {dur_s:5.2f}s audio in {gen_s:5.2f}s  RTF={rtf:.2f}  -> {out.name}")

    print(f"done  total={time.time() - t0:.1f}s  out={OUT_DIR}")


if __name__ == "__main__":
    main()
