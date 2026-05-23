#!/usr/bin/env python3
"""Mix a background-music bed under a video's existing audio, with sidechain
ducking so the music dips when speech/UI sounds are loud, then re-encode.

Usage:
    mix-bgm.py <video.mp4> <bgm.m4a> <output.mp4> [options]

Filter graph (single ffmpeg pass):
    [0:a]asplit=2[sp_mix][sp_sc];           # speech: one copy goes to mix, one drives sidechain
    [1:a]volume=<bgm-db>dB[bgm];            # music turned down to bed level
    [bgm][sp_sc]sidechaincompress=...[bgm_d];  # music ducked by speech amplitude
    [sp_mix][bgm_d]amix=duration=first:normalize=0[mixed];
    [mixed]loudnorm=I=-14:LRA=11:TP=-1.5[out]  # final loudness for YouTube

Video stream is copied unchanged (no re-encode), so this is fast.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", type=Path)
    ap.add_argument("bgm", type=Path)
    ap.add_argument("output", type=Path)
    ap.add_argument("--bgm-db", type=float, default=-9.0,
                    help="Music bed level in dB before sidechain (default: -9)")
    ap.add_argument("--threshold", type=float, default=0.03,
                    help="Sidechain trigger amplitude 0..1 (default: 0.03 ≈ -30dBFS)")
    ap.add_argument("--ratio", type=float, default=6.0,
                    help="Sidechain compression ratio (default: 6)")
    ap.add_argument("--attack", type=float, default=10.0,
                    help="Attack ms — how fast music ducks when speech starts (default: 10)")
    ap.add_argument("--release", type=float, default=400.0,
                    help="Release ms — how fast music returns after speech (default: 400)")
    ap.add_argument("--fade-out", type=float, default=1.5,
                    help="Fade music out over the last N seconds of the video "
                         "(default: 1.5; matters when YouTube loops the video — "
                         "avoids an abrupt music cutoff)")
    ap.add_argument("--master-fade-out", type=float, default=0.2,
                    help="Fade the WHOLE mix (speech + music) at the very end "
                         "(default: 0.2; prevents the audio click at video end)")
    ap.add_argument("--loudnorm", action="store_true", default=True,
                    help="Apply final loudnorm to -14 LUFS (default: on)")
    ap.add_argument("--no-loudnorm", dest="loudnorm", action="store_false")
    args = ap.parse_args()

    if not args.video.is_file():
        sys.exit(f"video not a file: {args.video}")
    if not args.bgm.is_file():
        sys.exit(f"bgm not a file: {args.bgm}")
    args.output.parent.mkdir(parents=True, exist_ok=True)

    # Probe video duration so we can position the music fade-out
    video_dur = float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(args.video)
    ], text=True).strip())
    fade_start = max(0.0, video_dur - args.fade_out)

    bgm_chain = f"[1:a]volume={args.bgm_db}dB"
    if args.fade_out > 0:
        bgm_chain += f",afade=t=out:st={fade_start:.3f}:d={args.fade_out:.3f}"
    bgm_chain += "[bgm]"

    filter_parts = [
        "[0:a]asplit=2[sp_mix][sp_sc]",
        bgm_chain,
        (f"[bgm][sp_sc]sidechaincompress="
         f"threshold={args.threshold}:ratio={args.ratio}:"
         f"attack={args.attack}:release={args.release}:"
         f"makeup=1[bgm_d]"),
        "[sp_mix][bgm_d]amix=inputs=2:duration=first:normalize=0[mixed]",
    ]
    cur_label = "[mixed]"
    if args.master_fade_out > 0:
        m_fade_start = max(0.0, video_dur - args.master_fade_out)
        filter_parts.append(
            f"{cur_label}afade=t=out:st={m_fade_start:.3f}:"
            f"d={args.master_fade_out:.3f}[mixed_faded]"
        )
        cur_label = "[mixed_faded]"
    if args.loudnorm:
        filter_parts.append(f"{cur_label}loudnorm=I=-14:LRA=11:TP=-1.5[out]")
        out_label = "[out]"
    else:
        out_label = cur_label
    filter_complex = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y", "-nostdin",
        "-i", str(args.video),
        "-i", str(args.bgm),
        "-filter_complex", filter_complex,
        "-map", "0:v",
        "-map", out_label,
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart",
        "-shortest",
        str(args.output),
    ]
    print(f"=> mixing {args.video.name} + {args.bgm.name} → {args.output.name}")
    subprocess.run(cmd, check=True)
    print(f"OK wrote {args.output}")


if __name__ == "__main__":
    main()
