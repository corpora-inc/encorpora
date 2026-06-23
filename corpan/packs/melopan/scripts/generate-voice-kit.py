#!/usr/bin/env python3
"""
Generate the melopan voice kit by running Chatterbox against the user's local
voice clone WAVs.

For each (voice, word) in the kit, renders a short WAV via Chatterbox using
the voice's reference clone, then encodes to OGG (via ffmpeg) for size.

Output: corpan/packs/melopan/public/voice-kit/{voice}/{word}.ogg

Idempotent — already-rendered files are skipped, so you can rerun to fill gaps.

Usage:
    python3 scripts/generate-voice-kit.py                       # all voices, all words
    python3 scripts/generate-voice-kit.py --voice flo
    python3 scripts/generate-voice-kit.py --voice ian --word mountain
    python3 scripts/generate-voice-kit.py --format wav          # skip OGG encode
    python3 scripts/generate-voice-kit.py --list                # show config and exit

Prereqs:
    * Chatterbox installed in the active Python env
      (`pip install chatterbox-tts` or wherever your env is)
    * ffmpeg on PATH (for OGG encoding; omit with --format wav)
    * Reference clones present at the paths listed in VOICE_REFERENCES below.
"""

import argparse
import shutil
import subprocess
import sys
import time
from pathlib import Path

PACK_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_ROOT = PACK_ROOT / "public" / "voice-kit"

# Default clone directory (per Jeff's local layout).
# Override via --clones-dir <path>.
DEFAULT_CLONES_DIR = Path.home() / "Desktop" / "corpan-voice-clones"

# Reference WAV per voice. Paths are RELATIVE to clones-dir.
# Add or change voices here; the rest of the pipeline picks them up.
VOICE_REFERENCES = {
    "amr":      "amr-syria.wav",
    "karina":   "karina-quebec.wav",
    "august":   "voice clone august 20.wav",
    "kym":      "voice clone kim 40.wav",
    "sky":      "voice clone sky 21 design.wav",
    "victor":   "new-voice-clones/victor business clone.wav",
    "avery":    "new-voice-clones/avery cheer clone 1.wav",
    "isabelle": "new-voice-clones/isabelle gymnastic clone .wav",
    "ryan":     "new-voice-clones/ryan baseball clone.wav",
}

# The melopan elemental voice kit.
# ~76 fundamental concepts across elements / living / food / action / direction /
# time / body / connection / counting. Easy to extend.
VOICE_KIT_WORDS = [
    # elements & nature
    "mountain", "river", "fire", "water", "earth", "air", "sky", "sun", "moon",
    "star", "ocean", "valley", "tree", "stone", "wind", "rain", "light", "dark",
    # living
    "people", "person", "baby", "mother", "father", "child", "friend", "family",
    # food
    "food", "eat", "bread", "corn", "rice", "salt", "fruit", "drink",
    # action
    "walk", "run", "dance", "sing", "dream", "love", "see", "hear", "breathe",
    "play", "build",
    # direction & space
    "up", "down", "here", "there", "near", "far",
    # time
    "day", "night", "morning", "now",
    # body & spirit
    "heart", "hand", "eye", "voice", "breath", "soul",
    # connection
    "home", "hello", "yes", "no", "thank",
    # counting (handy for melodic phrasing)
    "one", "two", "three", "four", "five", "six", "seven", "eight",
]


def _load_model(device):
    """Import + load Chatterbox lazily so --list and --help work without it."""
    try:
        # The voices/ pipeline uses the single-l name `mtl_tts`.
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS  # type: ignore
    except ImportError:
        try:
            # Some forks use `mtls_tts`. Try that as a fallback.
            from chatterbox.mtls_tts import ChatterboxMultilingualTTS  # type: ignore
        except ImportError as e:
            print(
                "[melopan] Chatterbox isn't installed in this Python env: "
                f"{e}\n"
                "Activate the voices/ env (or wherever you run sample_august.py) and re-run.",
                file=sys.stderr,
            )
            sys.exit(2)
    return ChatterboxMultilingualTTS.from_pretrained(device=device)


def _pick_device():
    import torch  # type: ignore
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def render_one(model, sr, voice: str, word: str, ref_wav: Path, out_wav: Path, lang: str, cfg_weight: float) -> None:
    import soundfile as sf  # type: ignore
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    wav = model.generate(
        text=word,
        language_id=lang,
        audio_prompt_path=str(ref_wav),
        cfg_weight=cfg_weight,
        temperature=0.3,
        repetition_penalty=2.0,
    )
    wav_np = wav.detach().cpu().squeeze().numpy()  # mono float32
    sf.write(str(out_wav), wav_np, sr, subtype="PCM_16")


def encode_ogg(wav_path: Path, ogg_path: Path, bitrate_kbps: int = 96) -> bool:
    if not shutil.which("ffmpeg"):
        print(
            f"[melopan] ffmpeg not on PATH — leaving WAV: {wav_path}",
            file=sys.stderr,
        )
        return False
    ogg_path.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(wav_path),
            "-c:a", "libvorbis",
            "-b:a", f"{bitrate_kbps}k",
            str(ogg_path),
        ],
        capture_output=True,
    )
    if result.returncode != 0:
        print(
            f"[melopan] ffmpeg failed for {wav_path}:\n"
            f"{result.stderr.decode(errors='ignore')}",
            file=sys.stderr,
        )
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--voice", help="Only render this voice (e.g. 'flo')", default=None)
    parser.add_argument("--word", help="Only render this word (e.g. 'mountain')", default=None)
    parser.add_argument("--format", choices=["ogg", "wav"], default="ogg",
                        help="Output format. WAV is faster but ~10x larger.")
    parser.add_argument("--language", default="en", help="Chatterbox language id (default: en)")
    parser.add_argument("--cfg-weight", type=float, default=0.85,
                        help="Chatterbox cfg_weight (default: 0.85)")
    parser.add_argument("--clones-dir", default=str(DEFAULT_CLONES_DIR),
                        help="Directory containing reference clone WAVs")
    parser.add_argument("--list", action="store_true",
                        help="Print resolved config and exit")
    args = parser.parse_args()

    clones_dir = Path(args.clones_dir).expanduser()
    voices = [args.voice] if args.voice else list(VOICE_REFERENCES.keys())
    words = [args.word] if args.word else VOICE_KIT_WORDS

    # Resolve reference paths and check existence early.
    resolved = []
    for v in voices:
        if v not in VOICE_REFERENCES:
            print(f"[melopan] Unknown voice: {v} (known: {', '.join(VOICE_REFERENCES)})", file=sys.stderr)
            sys.exit(2)
        ref = clones_dir / VOICE_REFERENCES[v]
        resolved.append((v, ref, ref.exists()))

    print("[melopan] voice kit generation")
    print(f"  clones dir : {clones_dir}")
    print(f"  output     : {OUTPUT_ROOT}")
    print(f"  words      : {len(words)}")
    print(f"  language   : {args.language}    cfg_weight: {args.cfg_weight}    format: {args.format}")
    print("  voices:")
    for v, ref, exists in resolved:
        mark = "✓" if exists else "✗ MISSING"
        print(f"    {mark}  {v:10s}  {ref}")

    if args.list:
        return

    missing = [v for v, _, e in resolved if not e]
    if missing:
        print(f"\n[melopan] Skipping missing voices: {', '.join(missing)}", file=sys.stderr)
        resolved = [(v, r, e) for v, r, e in resolved if e]

    if not resolved:
        print("[melopan] No usable voices found. Check --clones-dir.", file=sys.stderr)
        sys.exit(1)

    # Quick total estimate
    total_renders = 0
    for v, _ref, _ in resolved:
        out_dir = OUTPUT_ROOT / v
        for w in words:
            target = out_dir / f"{w}.ogg" if args.format == "ogg" else out_dir / f"{w}.wav"
            if not target.exists():
                total_renders += 1
    if total_renders == 0:
        print("[melopan] All targets already exist. Nothing to render.")
        return
    print(f"\n[melopan] {total_renders} renders queued.")

    device = _pick_device()
    print(f"[melopan] device={device}  loading Chatterbox...")
    t0 = time.time()
    model = _load_model(device)
    sr = model.sr
    print(f"[melopan] model loaded in {time.time() - t0:.1f}s  sr={sr}")

    done = 0
    for v, ref_wav, _ in resolved:
        out_dir = OUTPUT_ROOT / v
        for w in words:
            wav_out = out_dir / f"{w}.wav"
            ogg_out = out_dir / f"{w}.ogg"
            target = ogg_out if args.format == "ogg" else wav_out
            if target.exists():
                continue

            t = time.time()
            render_one(model, sr, v, w, ref_wav, wav_out, args.language, args.cfg_weight)
            gen_s = time.time() - t

            if args.format == "ogg":
                if encode_ogg(wav_out, ogg_out):
                    wav_out.unlink(missing_ok=True)

            done += 1
            print(f"  [{done:>3}/{total_renders}] {v}/{w}  ({gen_s:4.1f}s)")

    print(f"\n[melopan] done. {done} files in {OUTPUT_ROOT}")


if __name__ == "__main__":
    main()
