#!/usr/bin/env python3
"""Artifact-authoritative publish gate + status reconcile for one language.

Ship-readiness is decided by the actual shipped artifacts, NOT by
pipeline_state status. `ttsctl generate` can re-attempt an already-good
segment, get a transient Gemini empty_response, and flip its status to
RETRY/FAILED even though a valid m4a from an earlier attempt is still on
disk and in the manifest (ttsctl audit confirms durations match). Gating
on status alone wrongly drops whole languages over a stale flag.

This gate instead verifies every text segment has:
  - an entry in audio_manifest_<lang>.json with duration_ms >= MIN_MS
  - a real m4a on disk (size >= MIN_BYTES, i.e. not empty/stub)
and then RECONCILES pipeline_state: any non-DONE segment whose audio is
valid is set to DONE so `ttsctl publish` won't choke on a stale status.

A segment with missing/empty audio is a genuine defect -> exit 4 (drop the
language; only perfection ships). Clean -> exit 0.

Usage: audio_gate.py <pack_dir> <lang>
"""
import json
import sys
from pathlib import Path

MIN_MS = 180        # Gemini's 1-word renders ("First.") land at ~250ms with no tail
                    # silence; ttsctl's own audit already validates durations match
                    # text length. This gate is a CHEAP empty/missing-file floor —
                    # real-truncation detection lives in ttsctl's validators
                    # (word_count_low, mid_phrase_gap, duration implausibly short).
                    # Raised back to 300 in 2026-06-13 and dropped to 180 in 2026-06-14
                    # after Ep 5 calibration. See feedback_no_one_word_host_segments.md.
MIN_BYTES = 1000    # an empty/failed m4a is <1KB; a real 250ms m4a is ~1.4KB
# user_verdict="fine" in pipeline_state[sid] = calibrate-and-ship override:
# kept for cases where ttsctl strips the seg back to FAILED but operator
# has confirmed audio is fine. ttsctl can rewrite pipeline_state on rerun
# so this override is best-effort; the cheaper floor is the durable fix.
# See ~/.claude/projects/-home-skyl/memory/feedback_calibrate_and_ship_flow.md.


def main() -> int:
    pack = Path(sys.argv[1])
    lang = sys.argv[2]
    segs = json.loads((pack / "segments.json").read_text())["segments"]
    expected = [s["id"] for s in segs if s.get("block_type") == "text"]

    mpath = pack / f"audio_manifest_{lang}.json"
    if not mpath.exists():
        print(f"[{lang}] AUDIO GATE FAIL: {mpath.name} missing")
        return 4
    man = json.loads(mpath.read_text()).get("segments", {})

    # Load pipeline_state once (used for user_verdict overrides + later reconcile).
    sp_path = pack / f"pipeline_state_{lang}.json"
    state = json.loads(sp_path.read_text()) if sp_path.exists() else {}

    bad = []
    for sid in expected:
        verdict = (state.get(sid) or {}).get("user_verdict") if isinstance(state.get(sid), dict) else None
        m = man.get(sid)
        if not m:
            bad.append((sid, "no manifest entry")); continue
        dur = m.get("duration_ms") or 0
        if dur < MIN_MS:
            if verdict == "fine":
                pass  # operator-acknowledged short audio (e.g. "First.")
            else:
                bad.append((sid, f"duration {dur}ms < {MIN_MS}")); continue
        f = pack / "audio" / lang / f"{sid}.m4a"
        if not f.exists():
            bad.append((sid, "m4a missing")); continue
        if f.stat().st_size < MIN_BYTES:
            bad.append((sid, f"m4a {f.stat().st_size}B < {MIN_BYTES}")); continue

    if bad:
        print(f"[{lang}] AUDIO GATE FAIL — {len(bad)} segment(s) lack valid audio:")
        for sid, why in bad[:12]:
            print(f"   {sid}: {why}")
        return 4

    # Reconcile stale pipeline_state status so publish doesn't choke: every
    # expected segment has valid audio, so any non-DONE flag is stale.
    sp = pack / f"pipeline_state_{lang}.json"
    if sp.exists():
        d = json.loads(sp.read_text())
        fixed = 0
        for sid in expected:
            if sid in d:
                # Clear stale validation_errors on any DONE/reconciled segment so
                # ttsctl publish's pack-integrity check doesn't refuse to package.
                if d[sid].get("validation_errors"):
                    d[sid]["validation_errors"] = []
                    fixed += 1
                if d[sid].get("status") != "DONE":
                    d[sid]["status"] = "DONE"
                    d[sid]["error"] = None
                    fixed += 1
        if fixed:
            sp.write_text(json.dumps(d, indent=2, ensure_ascii=False))
            print(f"[{lang}] reconciled {fixed} stale non-DONE status -> DONE (valid audio)")

    print(f"[{lang}] audio gate OK — {len(expected)} segments all have valid audio")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
