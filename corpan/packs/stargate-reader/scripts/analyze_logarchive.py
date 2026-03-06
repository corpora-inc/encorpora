#!/usr/bin/env python3
"""
Quick analyzer for iOS logarchives used in Stargate Reader debugging.

Usage:
  python3 scripts/analyze_logarchive.py /tmp/corpan.logarchive
"""

from __future__ import annotations

import re
import subprocess
import sys
from collections import Counter


def run_log_show(archive_path: str) -> list[str]:
    predicate = (
        'eventMessage CONTAINS "AUDIO_KEEPALIVE" OR '
        'eventMessage CONTAINS "MRMediaRemoteSetCanBeNowPlayingApplication" OR '
        'eventMessage CONTAINS "MediaSessionManageriOS::updateNowPlayingInfo" OR '
        'eventMessage CONTAINS "didReceiveRemoteControlCommand" OR '
        'eventMessage CONTAINS "NPIC: setNowPlayingInfo" OR '
        'eventMessage CONTAINS "AVAudioEngine.mm"'
    )
    cmd = [
        "/usr/bin/log",
        "show",
        archive_path,
        "--style",
        "compact",
        "--predicate",
        predicate,
    ]
    out = subprocess.check_output(cmd, text=True, errors="ignore")
    return [ln for ln in out.splitlines() if ln and not ln.startswith("Timestamp")]


def main() -> int:
    archive = sys.argv[1] if len(sys.argv) > 1 else "/tmp/corpan.logarchive"

    try:
        lines = run_log_show(archive)
    except subprocess.CalledProcessError as exc:
        print(f"failed to read logarchive: {exc}", file=sys.stderr)
        return 2

    counts = Counter()
    command_counts = Counter()

    for line in lines:
        if "AUDIO_KEEPALIVE] start" in line:
            counts["keepalive_start"] += 1
        if "AUDIO_KEEPALIVE] stop" in line:
            counts["keepalive_stop"] += 1
        if "AUDIO_KEEPALIVE] pause" in line:
            counts["keepalive_pause"] += 1
        if "AUDIO_KEEPALIVE] resume" in line:
            counts["keepalive_resume"] += 1
        if "MRMediaRemoteSetCanBeNowPlayingApplication set to YES" in line:
            counts["owner_webkit_yes"] += 1
        if "MRMediaRemoteSetCanBeNowPlayingApplication set to NO" in line:
            counts["owner_webkit_no"] += 1
        if "updateNowPlayingInfo(0) clearing now playing info" in line:
            counts["webkit_clears_nowplaying"] += 1
        if "NPIC: setNowPlayingInfo: sending to MediaRemote" in line:
            counts["native_npic_writes"] += 1
        if "iounit stopped unexpectedly" in line:
            counts["avengine_iounit_stopped"] += 1

        m = re.search(r"didReceiveRemoteControlCommand\([^)]*\)\s+([A-Za-z]+Command)", line)
        if m:
            command_counts[m.group(1)] += 1

    print("== Stargate Reader Log Summary ==")
    print(f"archive: {archive}")
    print()
    print("Keepalive:")
    print(f"  start={counts['keepalive_start']} stop={counts['keepalive_stop']} "
          f"pause={counts['keepalive_pause']} resume={counts['keepalive_resume']}")
    print("Ownership / Now Playing:")
    print(f"  WebKit owner YES={counts['owner_webkit_yes']} NO={counts['owner_webkit_no']} "
          f"clears={counts['webkit_clears_nowplaying']} native_writes={counts['native_npic_writes']}")
    print("AVAudioEngine health:")
    print(f"  iounit_stopped_unexpectedly={counts['avengine_iounit_stopped']}")
    print("Remote commands:")
    if command_counts:
        for cmd, n in sorted(command_counts.items()):
            print(f"  {cmd}: {n}")
    else:
        print("  (none)")

    print()
    print("Heuristics:")
    if counts["avengine_iounit_stopped"] > 0:
        print("  WARN: native silent-loop engine instability detected.")
    if counts["keepalive_pause"] > counts["keepalive_start"] * 3:
        print("  WARN: frequent pause/resume flapping.")
    if counts["owner_webkit_yes"] > 0 and counts["native_npic_writes"] > 0:
        print("  INFO: mixed ownership (WebKit + native NPIC) still active.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
