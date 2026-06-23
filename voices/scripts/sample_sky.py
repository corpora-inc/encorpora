"""Generate Skylar voice samples across 9 languages for quality evaluation.

Output:
  /home/skyl/encorpora/voices/data/samples/sky/<lang>.wav
  /home/skyl/encorpora/voices/data/samples/sky/<lang>.m4a
"""
from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path

import soundfile as sf
import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

REF_WAV = Path("/home/skyl/encorpora/voices/data/sky-21.wav")
OUT_DIR = Path("/home/skyl/encorpora/voices/data/samples/sky")

# Same content across all languages so the comparison is apples-to-apples.
# Three sentences. Music-adjacent content matches what Skylar will narrate.
SAMPLES: dict[str, str] = {
    "en": (
        "Long ago, people made music with strings and wood. "
        "Today, music travels around the world. "
        "Listen carefully, and you can hear stories from many lands."
    ),
    "fr": (
        "Il y a longtemps, les gens faisaient de la musique avec des cordes et du bois. "
        "Aujourd'hui, la musique voyage à travers le monde entier. "
        "Écoute bien, et tu pourras entendre des histoires venues de nombreux pays."
    ),
    "es": (
        "Hace mucho tiempo, las personas hacían música con cuerdas y madera. "
        "Hoy, la música viaja por todo el mundo. "
        "Escucha con atención, y podrás oír historias de muchas tierras."
    ),
    "de": (
        "Vor langer Zeit machten die Menschen Musik mit Saiten und Holz. "
        "Heute reist die Musik um die ganze Welt. "
        "Hör genau hin, und du kannst Geschichten aus vielen Ländern hören."
    ),
    "ru": (
        "Давным-давно люди делали музыку из струн и дерева. "
        "Сегодня музыка путешествует по всему миру. "
        "Слушай внимательно, и ты сможешь услышать истории из многих стран."
    ),
    "zh": (
        "很久以前，人们用琴弦和木头制作音乐。"
        "今天，音乐传遍了整个世界。"
        "仔细听，你就能听见来自许多地方的故事。"
    ),
    "no": (
        "For lenge siden lagde folk musikk av strenger og tre. "
        "I dag reiser musikken rundt hele verden. "
        "Lytt nøye, og du kan høre fortellinger fra mange land."
    ),
    "sw": (
        "Zamani za kale, watu walitengeneza muziki kwa nyuzi na mbao. "
        "Leo, muziki husafiri kote ulimwenguni. "
        "Sikiliza kwa makini, na utaweza kusikia hadithi kutoka nchi nyingi."
    ),
    "hi": (
        "बहुत समय पहले, लोग तार और लकड़ी से संगीत बनाते थे। "
        "आज, संगीत पूरी दुनिया में यात्रा करता है। "
        "ध्यान से सुनो, और तुम कई देशों की कहानियाँ सुन पाओगे।"
    ),
}

CFG_WEIGHT = 0.85  # memory baseline


def master_to_m4a(wav: Path, m4a: Path) -> None:
    """WAV -> AAC 96k m4a with 0.4s tail fade-out."""
    # ffprobe duration
    dur_s = float(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=nw=1:nk=1",
                str(wav),
            ]
        )
        .decode()
        .strip()
    )
    fade_start = max(0.0, dur_s - 0.4)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "warning",
            "-i",
            str(wav),
            "-af",
            f"afade=t=out:st={fade_start}:d=0.4",
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            "-movflags",
            "+faststart",
            str(m4a),
        ]
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"device={device}  ref={REF_WAV.name}  cfg_weight={CFG_WEIGHT}")
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise SystemExit("ffmpeg/ffprobe not on PATH")

    t0 = time.time()
    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    print(f"model loaded in {time.time() - t0:.1f}s  sr={model.sr}")

    m4as: list[Path] = []
    for lang, text in SAMPLES.items():
        wav = OUT_DIR / f"{lang}.wav"
        m4a = OUT_DIR / f"{lang}.m4a"
        t = time.time()
        wav_t = model.generate(
            text=text,
            language_id=lang,
            audio_prompt_path=str(REF_WAV),
            cfg_weight=CFG_WEIGHT,
        )
        gen_s = time.time() - t
        wav_np = wav_t.detach().cpu().squeeze().numpy()
        sf.write(str(wav), wav_np, model.sr, subtype="PCM_16")
        dur_s = wav_np.shape[-1] / model.sr
        rtf = gen_s / dur_s if dur_s > 0 else float("nan")
        master_to_m4a(wav, m4a)
        m4as.append(m4a)
        print(
            f"  {lang}: {dur_s:5.2f}s audio in {gen_s:5.2f}s  RTF={rtf:.2f}  -> {m4a.name}"
        )

    print(f"\ndone  total={time.time() - t0:.1f}s  out={OUT_DIR}\n")
    print("Listen to these m4as on the Spark:")
    for p in m4as:
        print(f"  {p}")


if __name__ == "__main__":
    main()
