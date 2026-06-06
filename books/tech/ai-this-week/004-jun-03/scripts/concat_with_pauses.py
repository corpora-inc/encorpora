#!/usr/bin/env python3
"""Concat per-segment m4a files into a listen-test, inserting per-segment
pause_after_ms silence between segments. Output: a single m4a.

Usage:
    python3 concat_with_pauses.py <pack_dir> <lang> <out_m4a>
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 4:
        print(__doc__, file=sys.stderr)
        sys.exit(1)
    pack_dir = Path(sys.argv[1]).resolve()
    lang = sys.argv[2]
    out = Path(sys.argv[3]).resolve()

    segments = json.loads((pack_dir / "segments.json").read_text())["segments"]
    audio_dir = pack_dir / "audio" / lang

    with tempfile.TemporaryDirectory() as td:
        tdp = Path(td)
        # Render silence m4a for each unique pause length
        silence_files: dict[int, Path] = {}
        list_path = tdp / "list.txt"
        with list_path.open("w") as f:
            for seg in segments:
                m4a = audio_dir / f"{seg['id']}.m4a"
                if not m4a.exists():
                    print(f"WARN: missing {m4a}", file=sys.stderr)
                    continue
                f.write(f"file '{m4a}'\n")
                pause_ms = int(seg.get("tts", {}).get("pause_after_ms", 250))
                if pause_ms <= 0:
                    continue
                if pause_ms not in silence_files:
                    sil = tdp / f"silence_{pause_ms}.m4a"
                    subprocess.run([
                        "ffmpeg", "-y", "-f", "lavfi", "-i",
                        f"anullsrc=channel_layout=mono:sample_rate=24000",
                        "-t", f"{pause_ms/1000.0:.3f}",
                        "-c:a", "aac", "-b:a", "64k", str(sil),
                    ], check=True, capture_output=True)
                    silence_files[pause_ms] = sil
                f.write(f"file '{silence_files[pause_ms]}'\n")

        subprocess.run([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_path),
            "-c", "copy", str(out),
        ], check=True, capture_output=True)
    print(f"Wrote {out} ({out.stat().st_size/1024/1024:.1f} MB)")


if __name__ == "__main__":
    main()
