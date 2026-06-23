"""Reset retry/rewrite/plateau counts on stuck segs so ttsctl's auto_rewrite
gets another fresh budget cycle. Use for segs that exhausted their 3-rewrite
allotment but are real defects (MMS also flags them) — not Whisper FPs.

Usage:
  reset_stuck_budgets.py --lang ta --seg ch00-038
  reset_stuck_budgets.py --all-failed  # reset every FAILED seg across all langs
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

PACK = Path("/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1")
LANGS = ("ta", "te", "kn", "gu", "ur")


def reset_one(lang: str, seg_id: str) -> bool:
    state_path = PACK / f"pipeline_state_{lang}.json"
    if not state_path.exists():
        print(f"[{lang}] no state file")
        return False
    state = json.loads(state_path.read_text())
    segs = state.get("segments", state)
    if seg_id not in segs or not isinstance(segs[seg_id], dict):
        print(f"[{lang}/{seg_id}] not in state")
        return False
    s = segs[seg_id]
    before_status = s.get("status")
    before_rw = s.get("rewrite_count", 0)
    before_rt = s.get("retry_count", 0)
    s["status"] = "PENDING"
    s["retry_count"] = 0
    s["rewrite_count"] = 0
    s["plateau_count"] = 0
    s.pop("error", None)
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2))
    print(f"[{lang}/{seg_id}] reset: status={before_status}→PENDING  rewrite={before_rw}→0  retry={before_rt}→0")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang")
    ap.add_argument("--seg")
    ap.add_argument("--all-failed", action="store_true", help="reset every FAILED seg in every lang")
    args = ap.parse_args()

    if args.all_failed:
        total = 0
        for L in LANGS:
            sp = PACK / f"pipeline_state_{L}.json"
            if not sp.exists():
                continue
            state = json.loads(sp.read_text())
            segs = state.get("segments", state)
            for sid, s in list(segs.items()):
                if not isinstance(s, dict):
                    continue
                if s.get("status") == "FAILED":
                    reset_one(L, sid)
                    total += 1
        print(f"\nTotal: {total} FAILED segs reset across {len(LANGS)} langs")
    elif args.lang and args.seg:
        reset_one(args.lang, args.seg)
    else:
        ap.error("specify --lang+--seg, or --all-failed")


if __name__ == "__main__":
    main()
