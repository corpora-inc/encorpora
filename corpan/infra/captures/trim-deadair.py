#!/usr/bin/env python3
"""Trim dead-air segments (silent audio AND static video) from a screen capture.

Usage:
    trim-deadair.py <input.mov> <output.mp4> [options]
    trim-deadair.py <input.mov> <output.mp4> --dry-run        # analysis only

The detector finds intervals where BOTH the audio is silent AND the video is
essentially static, then cuts them out by trimming + concatenating the
"live" segments. Audio-only-talk over a still UI is preserved (motion is
static but audio is loud → not dead). Motion with no audio (a UI transition)
is also preserved (audio silent but motion isn't → not dead).

The pipeline is two analysis passes + one encode pass:
  1. `silencedetect` → silent intervals
  2. `tblend=difference,signalstats` → static intervals (via frame-to-frame
     luma diff at low fps)
  3. ffmpeg `trim`/`atrim`/`concat` → re-encoded output

No third-party Python deps (stdlib only).
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path


def probe_duration(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ], text=True)
    return float(out.strip())


def detect_silences(path: Path, threshold_db: float, min_duration: float) -> list[tuple[float, float]]:
    """Run `silencedetect` and return list of (start, end) silent intervals."""
    proc = subprocess.run([
        "ffmpeg", "-nostdin", "-i", str(path),
        "-af", f"silencedetect=noise={threshold_db}dB:duration={min_duration}",
        "-f", "null", "-"
    ], capture_output=True, text=True)
    intervals: list[tuple[float, float]] = []
    cur_start: float | None = None
    for line in proc.stderr.splitlines():
        m = re.search(r"silence_start: ([\d.]+)", line)
        if m:
            cur_start = float(m.group(1))
            continue
        m = re.search(r"silence_end: ([\d.]+)", line)
        if m and cur_start is not None:
            intervals.append((cur_start, float(m.group(1))))
            cur_start = None
    return intervals


def detect_static_intervals(path: Path, *, fps: int, threshold: float,
                            gap_max: float, min_duration: float) -> list[tuple[float, float]]:
    """Use tblend=all_mode=difference + signalstats to find low-motion intervals.

    At the chosen analysis fps, generate a diff-frame stream (each frame is
    abs-difference vs the previous). signalstats then gives mean luma (YAVG)
    of each diff frame — low YAVG = static. Aggregate runs of consecutive
    low-YAVG frames into intervals.
    """
    with tempfile.NamedTemporaryFile(suffix=".log", mode="w", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        subprocess.run([
            "ffmpeg", "-nostdin", "-i", str(path),
            "-vf", (
                f"fps={fps},"
                f"tblend=all_mode=difference,"
                f"signalstats,"
                f"metadata=mode=print:file={tmp_path}"
            ),
            "-f", "null", "-"
        ], capture_output=True, text=True)

        static_times: list[float] = []
        last_pts: float | None = None
        with open(tmp_path) as f:
            for line in f:
                m = re.match(r"frame:\d+\s+pts:\d+\s+pts_time:([\d.]+)", line)
                if m:
                    last_pts = float(m.group(1))
                    continue
                m = re.search(r"lavfi\.signalstats\.YAVG=([\d.]+)", line)
                if m and last_pts is not None:
                    yavg = float(m.group(1))
                    if yavg < threshold:
                        static_times.append(last_pts)
                    last_pts = None
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    # Aggregate consecutive low-YAVG samples into intervals
    if not static_times:
        return []
    static_times.sort()
    out: list[tuple[float, float]] = []
    start = prev = static_times[0]
    for t in static_times[1:]:
        if t - prev > gap_max:
            if prev - start >= min_duration:
                out.append((start, prev))
            start = t
        prev = t
    if prev - start >= min_duration:
        out.append((start, prev))
    return out


def intersect(a: list[tuple[float, float]], b: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Return intervals active in both `a` and `b`."""
    out: list[tuple[float, float]] = []
    for as_, ae in a:
        for bs, be in b:
            s, e = max(as_, bs), min(ae, be)
            if e > s:
                out.append((s, e))
    return out


def shrink_dead(intervals: list[tuple[float, float]], keep_head: float, keep_tail: float,
                min_remaining: float = 0.1) -> list[tuple[float, float]]:
    """Pull in each dead interval by keep_head/tail (so we don't cut too aggressively)."""
    out: list[tuple[float, float]] = []
    for s, e in intervals:
        ns, ne = s + keep_head, e - keep_tail
        if ne - ns >= min_remaining:
            out.append((ns, ne))
    return out


def merge_close(intervals: list[tuple[float, float]], gap_max: float = 0.0) -> list[tuple[float, float]]:
    """Merge intervals that overlap or are within gap_max of each other."""
    if not intervals:
        return []
    sorted_iv = sorted(intervals)
    merged = [sorted_iv[0]]
    for s, e in sorted_iv[1:]:
        ps, pe = merged[-1]
        if s <= pe + gap_max:
            merged[-1] = (ps, max(pe, e))
        else:
            merged.append((s, e))
    return merged


def invert(dead: list[tuple[float, float]], total: float) -> list[tuple[float, float]]:
    """Given dead intervals over [0, total], return the live (keep) intervals."""
    live: list[tuple[float, float]] = []
    prev = 0.0
    for s, e in sorted(dead):
        if s > prev:
            live.append((prev, s))
        prev = max(prev, e)
    if prev < total:
        live.append((prev, total))
    return live


def trim_and_concat(input_path: Path, live: list[tuple[float, float]], output_path: Path,
                    *, crf: int, preset: str) -> None:
    """ffmpeg filter_complex: trim each live segment, concat, re-encode."""
    parts: list[str] = []
    for i, (s, e) in enumerate(live):
        parts.append(
            f"[0:v]trim=start={s:.4f}:end={e:.4f},"
            f"setpts=PTS-STARTPTS,format=yuv420p[v{i}]"
        )
        parts.append(
            f"[0:a]atrim=start={s:.4f}:end={e:.4f},asetpts=PTS-STARTPTS[a{i}]"
        )
    concat_inputs = "".join(f"[v{i}][a{i}]" for i in range(len(live)))
    parts.append(
        f"{concat_inputs}concat=n={len(live)}:v=1:a=1[outv][outa]"
    )
    filter_complex = ";".join(parts)

    subprocess.run([
        "ffmpeg", "-y", "-nostdin", "-i", str(input_path),
        "-filter_complex", filter_complex,
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264", "-preset", preset, "-crf", str(crf),
        "-profile:v", "high",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart",
        str(output_path)
    ], check=True)


def fmt_t(s: float) -> str:
    m, s = divmod(s, 60)
    return f"{int(m):02d}:{s:05.2f}"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", type=Path)
    ap.add_argument("output", type=Path)
    ap.add_argument("--audio-db", type=float, default=-40.0,
                    help="Silence threshold in dB (default: -40)")
    ap.add_argument("--audio-min-dur", type=float, default=0.4,
                    help="Min silent duration to count (default: 0.4 s)")
    ap.add_argument("--motion-fps", type=int, default=10,
                    help="Analysis frame rate for motion detection (default: 10)")
    ap.add_argument("--motion-threshold", type=float, default=0.5,
                    help="YAVG of diff-frame below which is 'static' (default: 0.5, "
                         "scale 0-255; UI screen-recordings typically <0.5 when nothing is moving)")
    ap.add_argument("--motion-min-dur", type=float, default=0.4,
                    help="Min static duration to count (default: 0.4 s)")
    ap.add_argument("--keep-head", type=float, default=0.15,
                    help="Keep N s of dead air at start of each cut, for natural breath (default: 0.15)")
    ap.add_argument("--keep-tail", type=float, default=0.15,
                    help="Keep N s of dead air at end of each cut (default: 0.15)")
    ap.add_argument("--mode", choices=["both", "audio", "motion"], default="both",
                    help="Cut on intersection (both), audio-only, or motion-only (default: both)")
    ap.add_argument("--crf", type=int, default=18, help="x264 CRF (default: 18)")
    ap.add_argument("--preset", default="slow", help="x264 preset (default: slow)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Analyze + print, do not encode")
    args = ap.parse_args()

    if not args.input.is_file():
        sys.exit(f"input not a file: {args.input}")

    print(f"=> probing {args.input.name}")
    total = probe_duration(args.input)
    print(f"   duration: {fmt_t(total)}")

    silences: list[tuple[float, float]] = []
    if args.mode in ("both", "audio"):
        print(f"=> detecting silences (≤ {args.audio_db} dB for ≥ {args.audio_min_dur} s)")
        silences = detect_silences(args.input, args.audio_db, args.audio_min_dur)
        print(f"   found {len(silences)} silent intervals "
              f"({sum(e-s for s,e in silences):.1f} s total)")

    static: list[tuple[float, float]] = []
    if args.mode in ("both", "motion"):
        print(f"=> detecting static segments (YAVG < {args.motion_threshold} "
              f"for ≥ {args.motion_min_dur} s, analyzed at {args.motion_fps} fps)")
        static = detect_static_intervals(
            args.input, fps=args.motion_fps, threshold=args.motion_threshold,
            gap_max=1.5 / args.motion_fps, min_duration=args.motion_min_dur,
        )
        print(f"   found {len(static)} static intervals "
              f"({sum(e-s for s,e in static):.1f} s total)")

    if args.mode == "both":
        dead = intersect(silences, static)
    elif args.mode == "audio":
        dead = silences
    else:
        dead = static

    dead = shrink_dead(dead, args.keep_head, args.keep_tail)
    dead = merge_close(dead, gap_max=0.1)

    if not dead:
        print("=> no dead segments found; nothing to trim")
        return

    total_dead = sum(e - s for s, e in dead)
    print(f"=> cutting {len(dead)} dead intervals, total {fmt_t(total_dead)}:")
    for s, e in dead:
        print(f"     {fmt_t(s)} → {fmt_t(e)}  (-{e - s:.2f} s)")

    live = invert(dead, total)
    new_total = sum(e - s for s, e in live)
    pct = 100 * (total - new_total) / total
    print(f"=> output: {fmt_t(new_total)} (was {fmt_t(total)}, saved {pct:.1f}%)")

    if args.dry_run:
        print("(dry-run; not encoding)")
        return

    print(f"=> encoding {args.output} (libx264 CRF {args.crf} {args.preset})")
    trim_and_concat(args.input, live, args.output, crf=args.crf, preset=args.preset)
    print(f"OK wrote {args.output}")


if __name__ == "__main__":
    main()
