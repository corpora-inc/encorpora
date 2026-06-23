"""Flip Whisper-FAILED → DONE for segments where MMS confirms tail audio is fine.

Uses the audit corpus produced by indic_alignment_audit.py. NO regen — pure
state-file edit. Audio already exists on disk.

Defaults to dry-run; pass --apply to actually write back. Threshold controls
how confident MMS must be before clearing: tail_match_rate >= threshold.

Marks cleared segments with mms_cleared/mms_cleared_at/mms_tail_match in
the pipeline_state record so subsequent operations can see the override.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import shutil
import sys
from pathlib import Path

PACK = Path("/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1")
DEFAULT_AUDIT = Path("/home/skyl/encorpora/books/tech/ai-this-week/lang_records/indic_alignment_audit.jsonl")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--audit", default=str(DEFAULT_AUDIT), help="audit JSONL from indic_alignment_audit.py")
    ap.add_argument("--threshold", type=float, default=0.67, help="MMS tail_match_rate minimum to clear (default 0.67)")
    ap.add_argument("--apply", action="store_true", help="actually write changes; default is dry-run")
    ap.add_argument("--lang", help="restrict to a single lang (e.g. 'gu'); default all in audit")
    args = ap.parse_args()

    rows = [json.loads(l) for l in open(args.audit)]
    # Group candidates by lang.
    # Whisper-DONE segments are already shipped — skip. Everything else
    # (FAILED, RETRY, ALIGNED, VALIDATED — anything that hasn't completed
    # validation) is a candidate if MMS confirms the tail.
    by_lang: dict[str, list[dict]] = {}
    for r in rows:
        if r["whisper_status"] == "DONE":
            continue
        if r["tail_match_rate"] >= args.threshold:
            if args.lang and r["lang"] != args.lang:
                continue
            by_lang.setdefault(r["lang"], []).append(r)

    if not by_lang:
        print(f"No FAILED segments meet tail_match >= {args.threshold}. Nothing to clear.")
        return

    print(f"\n{'DRY-RUN' if not args.apply else 'APPLY'} mode. Threshold tail_match >= {args.threshold}.")
    print(f"Audit corpus: {args.audit}\n")

    ts = dt.datetime.now(dt.timezone.utc).isoformat()
    grand = 0
    for lang, candidates in sorted(by_lang.items()):
        state_path = PACK / f"pipeline_state_{lang}.json"
        if not state_path.exists():
            print(f"[{lang}] no state file at {state_path}; skipping")
            continue

        state = json.loads(state_path.read_text())
        segs = state.get("segments", state)
        # Identify whether state shape uses 'segments' dict or flat
        flat = "segments" not in state

        before_done = sum(1 for k, s in segs.items() if isinstance(s, dict) and s.get("status") == "DONE")
        cleared = []
        for cand in candidates:
            seg = segs.get(cand["seg_id"])
            if not isinstance(seg, dict):
                continue
            if seg.get("status") == "DONE":
                continue  # already DONE somehow
            # Flip
            seg["status"] = "DONE"
            seg["mms_cleared"] = True
            seg["mms_cleared_at"] = ts
            seg["mms_tail_match"] = cand["tail_match_rate"]
            seg["mms_hyp"] = cand["mms_hyp"]
            seg["mms_clear_reason"] = (
                f"Whisper-large-v3 flagged tail truncation "
                f"(whisper_tail_zeros={cand['whisper_tail_zero_count']}) "
                f"but MMS independent ASR transcribed {cand['mms_hyp_len']} chars "
                f"with tail_match_rate={cand['tail_match_rate']:.2f} >= {args.threshold}. "
                f"Audio confirmed clean by Tier-2 MMS cross-check."
            )
            cleared.append(cand["seg_id"])
        after_done = sum(1 for k, s in segs.items() if isinstance(s, dict) and s.get("status") == "DONE")
        delta = after_done - before_done
        grand += delta

        print(f"[{lang}] {len(cleared)} candidates → {delta} flipped to DONE  ({before_done}/62 → {after_done}/62)")
        for sid in cleared:
            r = next(c for c in candidates if c["seg_id"] == sid)
            print(f"    {sid}  tail_match={r['tail_match_rate']:.2f}  whisper_tail_zeros={r['whisper_tail_zero_count']}")

        if args.apply and delta > 0:
            backup = state_path.with_suffix(state_path.suffix + ".pre_mms_clear")
            if not backup.exists():
                shutil.copy(state_path, backup)
            tmp = state_path.with_suffix(state_path.suffix + ".tmp")
            tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2))
            tmp.replace(state_path)
            print(f"    wrote {state_path} (backup at {backup.name})")

    print(f"\nTotal: {grand} segments flipped FAILED→DONE across {len(by_lang)} langs.")
    if not args.apply:
        print("Dry-run only. Re-run with --apply to write changes.")


if __name__ == "__main__":
    main()
