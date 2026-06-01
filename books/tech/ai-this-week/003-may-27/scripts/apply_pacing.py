#!/usr/bin/env python3
"""Apply rule-based pacing to dialog segments.

Sets ``seg.tts.pause_after_ms`` based on conversational context. Also
updates the per-language audio_manifest if it exists, so the reader picks
up new pauses without a full re-master.

Pacing rules (in priority order):
    1. First segment            -> 1500ms (settle-in beat)
    2. Final segment            -> 1200ms (closure)
    3. Same speaker continuing  -> 250ms  (tight, breath-level pause)
    4. Speaker change after '?' -> 350ms  (question -> answer)
    5. Short reaction (<=4 wds) -> 500ms  (brief acknowledgement)
    6. Speaker change (default) -> 550ms  (normal turn boundary)

All values get +/- 50ms uniform jitter (seeded for reproducibility) so the
show does not feel mechanical.

Usage:
    apply_pacing.py <pack_dir> [lang]

If <lang> is given, the corresponding audio_manifest_{lang}.json is also
patched. Otherwise only segments.json is updated.
"""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path

SEED = 13  # change to reshuffle the jitter pattern

RULES = {
    "first":          600,
    "final":         1200,
    "same_speaker":   250,
    "question":       350,
    "short_reaction": 500,
    "speaker_change": 550,
}
JITTER_MS = 50

# Phrases counted as "short reactions" — brief acknowledgements that
# deserve a slightly longer pause to land before the next thought.
_SHORT_REACTION_MAX_WORDS = 4


def is_short_reaction(text: str) -> bool:
    words = text.strip().split()
    return len(words) <= _SHORT_REACTION_MAX_WORDS


def rule_for(i: int, segs: list[dict]) -> tuple[str, int]:
    if i == 0:
        return "first", RULES["first"]
    if i == len(segs) - 1:
        return "final", RULES["final"]
    cur = segs[i]
    nxt = segs[i + 1]
    cur_speaker = cur.get("speaker_id") or cur.get("tts", {}).get("speaker_id")
    nxt_speaker = nxt.get("speaker_id") or nxt.get("tts", {}).get("speaker_id")
    if cur_speaker and nxt_speaker and cur_speaker == nxt_speaker:
        return "same_speaker", RULES["same_speaker"]
    cur_text = cur.get("tts", {}).get("text") or cur.get("text", "")
    if cur_text.rstrip().endswith("?"):
        return "question", RULES["question"]
    if is_short_reaction(cur_text):
        return "short_reaction", RULES["short_reaction"]
    return "speaker_change", RULES["speaker_change"]


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2

    pack = Path(sys.argv[1])
    lang = sys.argv[2] if len(sys.argv) > 2 else None

    segp = pack / "segments.json"
    d = json.loads(segp.read_text())
    segs = d["segments"]

    rng = random.Random(SEED)
    counts: dict[str, int] = {}
    updates: dict[str, int] = {}

    for i, s in enumerate(segs):
        rule, base = rule_for(i, segs)
        jitter = rng.randint(-JITTER_MS, JITTER_MS)
        pause = base + jitter
        s.setdefault("tts", {})["pause_after_ms"] = pause
        counts[rule] = counts.get(rule, 0) + 1
        updates[s["id"]] = pause

    segp.write_text(json.dumps(d, indent=2, ensure_ascii=False))

    if lang:
        mp = pack / f"audio_manifest_{lang}.json"
        if mp.exists():
            m = json.loads(mp.read_text())
            for sid, p in updates.items():
                if sid in m["segments"]:
                    m["segments"][sid]["pause_after_ms"] = p
            mp.write_text(json.dumps(m, indent=2, ensure_ascii=False))
            print(f"updated audio_manifest_{lang}.json")

    print("pacing rule counts:")
    for r in ("first", "final", "same_speaker", "question",
              "short_reaction", "speaker_change"):
        if counts.get(r):
            print(f"  {r:<18} {counts[r]:>3}  (base {RULES[r]}ms +/- {JITTER_MS}ms)")
    total_pause_s = sum(updates.values()) / 1000.0
    print(f"total inter-segment silence: {total_pause_s:.1f}s "
          f"(avg {total_pause_s / len(updates) * 1000:.0f}ms per gap)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
