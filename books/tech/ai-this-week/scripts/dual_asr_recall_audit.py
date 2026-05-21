"""Compute MMS + Whisper free-transcribe word recall on every segment of a
lang in a pack. No pipeline changes — pure measurement.

Metrics per segment:
  mms_recall          : fraction of expected words present in MMS hyp
  whisper_recall      : same for Whisper free-transcribe (no target text)
  min_recall          : min(mms, whisper) — both engines have to fail to flag
  mms_hyp_words       : MMS word count
  whisper_hyp_words   : Whisper word count
  expected_words      : ground-truth word count
  dur_per_char_ms     : duration plausibility metric
  whisper_status      : current pipeline state status (DONE / FAILED / ...)

Output: ~/encorpora/books/tech/ai-this-week/lang_records/<lang>_dual_asr_recall.jsonl
"""
from __future__ import annotations

import argparse
import contextlib
import io
import json
import logging
import re
import sys
import time
import unicodedata
import warnings
from pathlib import Path

import soundfile as sf

warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)
sys.path.insert(0, "/home/skyl/projects/ttsctl")

PACK = Path("/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1")
OUT_DIR = Path("/home/skyl/encorpora/books/tech/ai-this-week/lang_records")


def norm(s: str) -> list[str]:
    s = unicodedata.normalize("NFC", s).casefold()
    s = re.sub(r"[0-9.,!?\"'()\[\]{};:\-—–%/§*]", " ", s)
    return [w for w in s.split() if w]


def recall(expected_words: list[str], hyp_words: list[str]) -> float:
    if not expected_words:
        return 0.0
    hyp_set = set(hyp_words)
    return sum(1 for w in expected_words if w in hyp_set) / len(expected_words)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", required=True)
    ap.add_argument("--limit", type=int, default=0, help="only audit first N segs (debug)")
    args = ap.parse_args()
    lang = args.lang

    with contextlib.redirect_stderr(io.StringIO()):
        from ttsctl.asr_mms import load_mms, transcribe as mms_transcribe, MMS_ADAPTER
        import stable_whisper
        if lang not in MMS_ADAPTER:
            print(f"[{lang}] no MMS adapter — refusing to audit (would skew metric)")
            return
        mms_model, mms_proc = load_mms(device="cuda")
        ws_model = stable_whisper.load_model("large-v3", device="cuda")

    seg_path = PACK / f"segments_{lang}.json"
    state_path = PACK / f"pipeline_state_{lang}.json"
    src = json.loads(seg_path.read_text())["segments"]
    state = json.loads(state_path.read_text())
    state_segs = state.get("segments", state)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{lang}_dual_asr_recall.jsonl"
    rows = []
    t0 = time.time()
    seg_list = [s for s in src if s["id"].startswith("ch")]
    if args.limit:
        seg_list = seg_list[: args.limit]
    print(f"[{lang}] auditing {len(seg_list)} segments...")

    for s in seg_list:
        sid = s["id"]
        wav = PACK / "audio" / lang / "wav" / f"{sid}.wav"
        if not wav.exists():
            continue
        expected = (s.get("tts") or {}).get("text") or s.get("text", "")
        if not expected:
            continue
        try:
            audio, sr = sf.read(str(wav))
            dur_ms = int(len(audio) * 1000 / sr)
        except Exception:
            continue
        try:
            with contextlib.redirect_stderr(io.StringIO()):
                mms_hyp = mms_transcribe(mms_model, mms_proc, str(wav), lang)
                w_result = ws_model.transcribe(
                    str(wav), language=lang, word_timestamps=False, verbose=False
                )
                w_hyp = w_result.text.strip() if hasattr(w_result, "text") else ""
        except Exception as e:
            print(f"  [{sid}] asr err: {e}")
            continue

        e_w = norm(expected)
        m_w = norm(mms_hyp)
        w_w = norm(w_hyp)
        mms_r = recall(e_w, m_w)
        w_r = recall(e_w, w_w)
        row = {
            "lang": lang,
            "seg_id": sid,
            "whisper_status": state_segs.get(sid, {}).get("status"),
            "audio_duration_ms": dur_ms,
            "expected_text": expected,
            "expected_word_count": len(e_w),
            "mms_hyp": mms_hyp,
            "mms_hyp_word_count": len(m_w),
            "whisper_hyp": w_hyp,
            "whisper_hyp_word_count": len(w_w),
            "mms_recall": round(mms_r, 3),
            "whisper_recall": round(w_r, 3),
            "min_recall": round(min(mms_r, w_r), 3),
            "dur_per_char_ms": round(dur_ms / max(1, len(expected)), 2),
            "hyp_word_ratio_mms": round(len(m_w) / max(1, len(e_w)), 3),
            "hyp_word_ratio_whisper": round(len(w_w) / max(1, len(e_w)), 3),
        }
        rows.append(row)
        print(
            f"  [{sid}] mms_r={mms_r:.2f} whisper_r={w_r:.2f} min={row['min_recall']:.2f} "
            f"e={len(e_w)}w m={len(m_w)}w w={len(w_w)}w status={row['whisper_status']}"
        )

    with out_path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"\nWrote {len(rows)} rows to {out_path} ({time.time()-t0:.0f}s)")

    # Sorted summary by min_recall ascending (worst first)
    rows.sort(key=lambda r: r["min_recall"])
    print(f"\n=== {lang}: worst-min-recall segments (suspect defects) ===")
    for r in rows[:10]:
        print(
            f"  {r['seg_id']}  min={r['min_recall']:.2f} (mms={r['mms_recall']:.2f} w={r['whisper_recall']:.2f})  "
            f"e={r['expected_word_count']}w  status={r['whisper_status']}"
        )
    print(f"\n=== {lang}: best-min-recall (clean baseline) ===")
    for r in rows[-5:]:
        print(
            f"  {r['seg_id']}  min={r['min_recall']:.2f} (mms={r['mms_recall']:.2f} w={r['whisper_recall']:.2f})"
        )


if __name__ == "__main__":
    main()
