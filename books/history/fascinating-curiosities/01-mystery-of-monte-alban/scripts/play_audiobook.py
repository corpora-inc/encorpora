#!/usr/bin/env python3
"""
Play segments back-to-back as an audiobook.

Usage:
    python3 play_audiobook.py                      # play from the beginning
    python3 play_audiobook.py --start ch03-144     # start from a specific segment
    python3 play_audiobook.py --chapter 5          # start from chapter 5
    python3 play_audiobook.py --list-chapters      # show chapter index

Controls (during playback):
    q / Ctrl+C   stop playback
"""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

PACK = Path(__file__).resolve().parent.parent / "pack"
SEGMENTS = PACK / "segments.json"
MANIFEST = PACK / "audio_manifest_en.json"


def load_data():
    segments = json.loads(SEGMENTS.read_text())["segments"]
    manifest = json.loads(MANIFEST.read_text())["segments"]
    return segments, manifest


def list_chapters(segments):
    seen = set()
    for seg in segments:
        if seg["block_type"] == "heading" and seg.get("heading_level", 0) <= 2:
            key = (seg["part"], seg["chapter"])
            if key not in seen:
                seen.add(key)
                print(f"  {seg['id']:12s}  {seg['text']}")


def play(segments, manifest, start_id=None, start_chapter=None):
    # Find starting index
    start = 0
    if start_id:
        for i, seg in enumerate(segments):
            if seg["id"] == start_id:
                start = i
                break
        else:
            print(f"Segment {start_id} not found", file=sys.stderr)
            sys.exit(1)
    elif start_chapter is not None:
        for i, seg in enumerate(segments):
            if seg["chapter"] == start_chapter:
                start = i
                break

    playable = [
        seg for seg in segments[start:]
        if seg["id"] in manifest
    ]

    print(f"Playing {len(playable)} segments starting from {playable[0]['id']}")
    print(f"Press q or Ctrl+C to stop\n")

    current_title = ""
    for i, seg in enumerate(playable):
        entry = manifest[seg["id"]]
        audio_path = PACK / entry["file"]

        if seg.get("title") and seg["title"] != current_title:
            current_title = seg["title"]
            print(f"\n--- {current_title} ---\n")

        label = seg["text"][:80] + ("..." if len(seg["text"]) > 80 else "")
        dur = entry["duration_ms"] / 1000
        print(f"[{i+1}/{len(playable)}] {seg['id']}  ({dur:.1f}s)  {label}")

        try:
            subprocess.run(
                ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet",
                 str(audio_path)],
                check=True,
            )
        except (KeyboardInterrupt, subprocess.CalledProcessError):
            print("\nStopped.")
            return

        # Inter-segment pause
        pause_s = entry.get("pause_after_ms", 500) / 1000
        try:
            time.sleep(pause_s)
        except KeyboardInterrupt:
            print("\nStopped.")
            return

    print("\nDone — end of book.")


def main():
    parser = argparse.ArgumentParser(description="Play audiobook segments")
    parser.add_argument("--start", help="Start from segment ID (e.g. ch03-144)")
    parser.add_argument("--chapter", type=int, help="Start from chapter number")
    parser.add_argument("--list-chapters", action="store_true", help="List chapters and exit")
    args = parser.parse_args()

    segments, manifest = load_data()

    if args.list_chapters:
        list_chapters(segments)
        return

    play(segments, manifest, start_id=args.start, start_chapter=args.chapter)


if __name__ == "__main__":
    main()
