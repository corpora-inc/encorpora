#!/usr/bin/env /home/skyl/tts_venv/bin/python
"""
Analyze /tmp/aitw_ep2_verdicts.json against pipeline_state_<lang>.json to:

1. Group verdicts by (check_type, lang).
2. Compute per-group FP rate (fine_count / verdicted_count).
3. Identify (check_type, lang) combos that are confirmed false-positives
   (FP rate ≥ 0.7 with ≥3 verdicts) — these are calibration candidates.
4. List 'broken' segs grouped by (lang, check_type) for codex auto_rewrite.
5. List 'unsure' segs needing more triage.

Usage:
  /home/skyl/encorpora/books/tech/ai-this-week/002-may-20/scripts/analyze_aitw_verdicts.py
"""
import json, collections, sys
from pathlib import Path

PACK = Path("/home/skyl/encorpora/books/tech/ai-this-week/002-may-20/packs/vindy-ron-gemini-v1")
VERDICTS = Path("/tmp/aitw_ep2_verdicts.json")

# These check types are SAFE to mark non-blocking ONLY when the verdict
# corpus confirms FP rate ≥70%. See:
# - feedback_first_word_weak_often_fp.md (Whisper alignment FPs)
# - feedback_gemini_abrupt_endings.md (Gemini-specific tail-silence behavior)
ALIGNMENT_FP_CANDIDATES = {
    "first_word_weak",
    "final_word_weak",
    "tail_energy",
    "first_word_truncated",
    "last_word_truncated",
    "min_trailing_silence",
    # Gemini-personality (abrupt endings):
    "tts_audio_truncated",   # FP on Gemini for 0ms-gap endings; cross-check below
    "trailing_silence",      # ditto
}

# Always-real defects — never auto-mark non-blocking, always require fix
REAL_DEFECTS = {
    "mid_phrase_gap",
    "pre_speech_spike",
    "post_speech_pop",
    "no_words",
    "tail_zero_duration_run",
    "word_count_low",       # actual missing content
    "head_truncation",
    "stacked_words",
    "word_cluster",
    "truncated_last_word",
    "language_leak",        # Indic-script Whisper occasionally FPs; defer to verdict
}


def err_types(state_entry):
    out = []
    for e in (state_entry or {}).get("validation_errors") or []:
        if isinstance(e, dict):
            out.append(e.get("type", "?"))
        else:
            out.append(str(e).split(":")[0])
    return out


def main():
    if not VERDICTS.exists():
        print(f"No verdicts file yet: {VERDICTS}")
        sys.exit(0)
    verdicts = json.loads(VERDICTS.read_text())

    # Load per-lang pipeline state for the err types
    states = {}
    for f in PACK.glob("pipeline_state_*.json"):
        L = f.name.split("pipeline_state_")[1].split(".")[0]
        states[L] = json.load(f.open())

    # (lang, check_type) -> Counter of verdicts
    by_lc = collections.defaultdict(lambda: collections.Counter())
    # (lang, check_type) -> seg ids with verdict broken
    broken_by_lc = collections.defaultdict(list)
    # 'unsure' segs needing more triage
    unsure_segs = collections.defaultdict(list)
    # per-lang verdict counts
    per_lang = collections.defaultdict(lambda: collections.Counter())

    total_verdicted = 0
    for key, entry in verdicts.items():
        if "_" not in key: continue
        lang, sid = key.split("_", 1)
        v = entry.get("verdict") if isinstance(entry, dict) else entry
        notes = entry.get("notes", "") if isinstance(entry, dict) else ""
        if v in ("unset", None): continue
        total_verdicted += 1
        per_lang[lang][v] += 1
        types = err_types(states.get(lang, {}).get(sid))
        if not types:
            types = ["NO_VALIDATION_ERRORS"]
        for t in types:
            by_lc[(lang, t)][v] += 1
            if v == "broken":
                broken_by_lc[(lang, t)].append((sid, notes))
            if v == "unsure":
                unsure_segs[lang].append((sid, t, notes))

    print(f"= AITW ep2 verdict analysis ({total_verdicted} segments verdicted) =\n")

    print("== Per-lang verdict counts ==")
    for lang in sorted(per_lang):
        c = per_lang[lang]
        print(f"  {lang:4}  fine={c['fine']:3}  broken={c['broken']:3}  unsure={c['unsure']:3}")

    print("\n== Per-(lang, check_type) FP rates (≥1 verdict) ==")
    rows = []
    for (lang, ct), counts in sorted(by_lc.items()):
        n_fine = counts["fine"]
        n_broken = counts["broken"]
        n_unsure = counts["unsure"]
        n_total = n_fine + n_broken + n_unsure
        if n_total == 0: continue
        fp_rate = n_fine / n_total if n_total else 0
        rows.append((lang, ct, n_fine, n_broken, n_unsure, n_total, fp_rate))
    for lang, ct, n_fine, n_broken, n_unsure, n_total, fp_rate in rows:
        marker = " ★ CALIBRATE" if (ct in ALIGNMENT_FP_CANDIDATES and fp_rate >= 0.7 and n_total >= 3) else ""
        print(f"  {lang:4}  {ct:30}  fine={n_fine:2}  broken={n_broken:2}  unsure={n_unsure:2}  n={n_total:2}  FP={fp_rate:.0%}{marker}")

    print("\n== Calibration candidates (alignment-class FP ≥ 70% with ≥3 verdicts) ==")
    calibration = []
    for (lang, ct), counts in by_lc.items():
        n_fine = counts["fine"]
        n_total = sum(counts.values()) - counts["unset"] if "unset" in counts else sum(counts.values())
        if ct in ALIGNMENT_FP_CANDIDATES and n_total >= 3 and (n_fine / n_total) >= 0.7:
            calibration.append((lang, ct, n_fine, n_total))
    if not calibration:
        print("  (none yet — need more verdicts)")
    else:
        for lang, ct, n_fine, n_total in calibration:
            print(f"  ({lang}, {ct}): {n_fine}/{n_total} fine — add to no_gemini_downgrade_checks for this (book, lang, voice)")
        print("\n  Plan: edit narration.yaml to add these per-(lang,voice) check exemptions,")
        print("  then run post_generate_fixup energy-onset patch, re-validate, publish.")

    print("\n== Real defects to fix (broken verdicts) ==")
    if not broken_by_lc:
        print("  (none)")
    else:
        for (lang, ct), segs in sorted(broken_by_lc.items()):
            print(f"  ({lang}, {ct}):  {len(segs)} segs")
            for sid, notes in segs:
                note_str = f" — \"{notes}\"" if notes else ""
                print(f"      {sid}{note_str}")

    print("\n== Unsure segs (need more triage) ==")
    if not unsure_segs:
        print("  (none)")
    else:
        for lang, segs in sorted(unsure_segs.items()):
            print(f"  {lang}: {len(segs)} segs")
            for sid, ct, notes in segs:
                note_str = f" — \"{notes}\"" if notes else ""
                print(f"      {sid}  ({ct}){note_str}")


if __name__ == "__main__":
    main()
