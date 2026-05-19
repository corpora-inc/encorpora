"""Measure whether MMS hears the tail words that Whisper flagged as truncated.

Runs over an existing pack's per-lang state + audio, no pipeline changes.
Output is a JSONL corpus where each row is one (lang, segment) pair with
both Whisper's verdict and MMS's free-transcription verdict side by side.

Cost-aware: uses MMS on cuda if available, falls back to cpu on OOM.
Doesn't write back into pipeline_state — pure measurement.
"""
from __future__ import annotations

import json
import sys
import time
import unicodedata
from pathlib import Path

import soundfile as sf

sys.path.insert(0, "/home/skyl/projects/ttsctl")
from ttsctl.asr_mms import MMS_ADAPTER, load_mms, transcribe as mms_transcribe

PACK = Path("/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1")
DEFAULT_OUT = Path("/home/skyl/encorpora/books/tech/ai-this-week/lang_records/indic_alignment_audit.jsonl")
DEFAULT_LANGS = ("ta", "te", "gu")
TAIL_N = 3  # how many tail words to check


def _parse_args(argv: list[str]) -> tuple[tuple[str, ...], Path]:
    """Allow override: --langs es,fr,de --out path.jsonl"""
    langs = DEFAULT_LANGS
    out = DEFAULT_OUT
    it = iter(argv)
    for a in it:
        if a == "--langs":
            langs = tuple(x.strip() for x in next(it).split(",") if x.strip())
        elif a == "--out":
            out = Path(next(it))
    return langs, out


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFC", s).casefold()
    for ch in ",.?!:;\"'()[]{}—–-":
        s = s.replace(ch, " ")
    return " ".join(s.split())


def tail_words(text: str, n: int) -> list[str]:
    return normalize(text).split()[-n:]


def tail_match_rate(expected_text: str, mms_hyp: str, n: int = TAIL_N) -> float:
    tail = tail_words(expected_text, n)
    if not tail:
        return 0.0
    hyp_norm = normalize(mms_hyp)
    hits = sum(1 for w in tail if w in hyp_norm)
    return hits / len(tail)


def whisper_tail_zero_count(seg_state: dict) -> int:
    """Extract last-attempt zero-duration tail run from retry_history."""
    rh = seg_state.get("retry_history") or []
    if not rh:
        return 0
    last_errs = rh[-1].get("errors") or []
    if "tail_zero_duration_run" not in last_errs:
        return 0
    err = seg_state.get("error") or ""
    if "tail_zero_duration_run:" not in err:
        return 0
    try:
        s = err.split("tail_zero_duration_run:")[1]
        return int(s.strip().split()[0])
    except Exception:
        return 0


def audio_duration_ms(wav_path: Path) -> int:
    a, sr = sf.read(str(wav_path))
    return int(len(a) * 1000 / sr)


def load_segments(lang: str) -> dict[str, dict]:
    segs_file = PACK / f"segments_{lang}.json"
    data = json.loads(segs_file.read_text())
    out = {}
    for seg in data.get("segments", []):
        out[seg["id"]] = seg
    return out


def main() -> None:
    langs, out_path = _parse_args(sys.argv[1:])
    print(f"Auditing langs={langs}, out={out_path}", flush=True)
    print(f"Loading MMS...", flush=True)
    try:
        model, proc = load_mms(device="cuda")
    except Exception as e:
        print(f"  cuda load failed ({e}); falling back to cpu", flush=True)
        model, proc = load_mms(device="cpu")
    print(f"MMS ready.", flush=True)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    t0 = time.time()
    for lang in langs:
        state_file = PACK / f"pipeline_state_{lang}.json"
        if not state_file.exists():
            print(f"\n[{lang}] no state; skipping")
            continue
        state = json.loads(state_file.read_text())
        segs_state = state.get("segments", state)
        segs_src = load_segments(lang)
        audio_dir = PACK / "audio" / lang / "wav"

        n_total = sum(1 for k, s in segs_state.items() if isinstance(s, dict) and k.startswith("ch"))
        n_done = sum(1 for k, s in segs_state.items() if isinstance(s, dict) and s.get("status") == "DONE")
        print(f"\n[{lang}] {n_total} segments in state ({n_done} DONE)", flush=True)

        for seg_id, seg_state in segs_state.items():
            if not isinstance(seg_state, dict):
                continue
            if not seg_id.startswith("ch"):
                continue
            wav = audio_dir / f"{seg_id}.wav"
            if not wav.exists():
                continue
            src_seg = segs_src.get(seg_id, {})
            expected = (src_seg.get("tts") or {}).get("text") or src_seg.get("text") or ""
            if not expected:
                continue

            try:
                dur_ms = audio_duration_ms(wav)
                t_seg = time.time()
                mms_hyp = mms_transcribe(model, proc, str(wav), lang)
                seg_time = time.time() - t_seg
            except Exception as e:
                print(f"  [{lang}/{seg_id}] mms err: {e}")
                continue

            rh = seg_state.get("retry_history") or []
            last_attempt = rh[-1] if rh else {}
            last_errs = list(last_attempt.get("errors") or [])

            row = {
                "lang": lang,
                "seg_id": seg_id,
                "whisper_status": seg_state.get("status"),
                "whisper_last_errors": last_errs,
                "whisper_tail_zero_count": whisper_tail_zero_count(seg_state),
                "rewrite_count": seg_state.get("rewrite_count", 0),
                "retry_count": seg_state.get("retry_count", 0),
                "audio_duration_ms": dur_ms,
                "expected_text": expected,
                "expected_char_len": len(expected),
                "duration_per_char_ms": round(dur_ms / max(1, len(expected)), 2),
                "mms_hyp": mms_hyp,
                "mms_hyp_len": len(mms_hyp),
                "tail_match_rate": tail_match_rate(expected, mms_hyp),
                "tail_expected": tail_words(expected, TAIL_N),
                "mms_time_sec": round(seg_time, 2),
            }
            rows.append(row)
            tag = "FAIL" if seg_state.get("status") != "DONE" else "done"
            print(
                f"  [{lang}/{seg_id}] {tag} "
                f"tail_match={row['tail_match_rate']:.2f} "
                f"dur/char={row['duration_per_char_ms']}ms "
                f"whisper_tail_zeros={row['whisper_tail_zero_count']} "
                f"mms_chars={len(mms_hyp)}",
                flush=True,
            )

    with out_path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    elapsed = time.time() - t0
    print(f"\nWrote {len(rows)} rows to {out_path} ({elapsed:.0f}s total)", flush=True)

    # Summary stats
    from collections import defaultdict
    by_lang_status = defaultdict(list)
    for r in rows:
        key = (r["lang"], "FAILED" if r["whisper_status"] != "DONE" else "DONE")
        by_lang_status[key].append(r["tail_match_rate"])
    print(f"\n=== Summary: mean tail_match_rate by (lang, whisper_status) ===")
    for (lang, status), vals in sorted(by_lang_status.items()):
        if vals:
            mean = sum(vals) / len(vals)
            print(f"  {lang} / {status:6} (n={len(vals):3}): mean={mean:.2f}  min={min(vals):.2f}  max={max(vals):.2f}")


if __name__ == "__main__":
    main()
