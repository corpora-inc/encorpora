#!/usr/bin/env /home/skyl/tts_venv/bin/python
"""
After fixing engine=gemini in narration.yaml, flip FAILED segs whose validation
errors are ALL in the Gemini-non-blocking set back to ALIGNED so the validate
phase re-runs them with the (now correct) Gemini engine downgrade applied.

Only flips segments whose ENTIRE error set is in the safe (Gemini-FP) list.
Anything with a real-defect error (truncated_last_word, mid_phrase_gap,
word_count_low, etc.) stays FAILED — those are real defects that need
codex auto_rewrite or hand-fix.

Usage:
  recalibrate_failed_to_aligned.py <lang>
"""
import sys, json, datetime
from pathlib import Path

PACK = Path("/home/skyl/encorpora/books/tech/ai-this-week/002-may-20/packs/vindy-ron-gemini-v1")
VERDICTS_FILE = Path("/tmp/aitw_ep2_verdicts.json")
NARRATION_YAML = PACK / "narration.yaml"

# Must match _GEMINI_VOICE_NON_BLOCKING_CHECKS in ttsctl/validator.py
GEMINI_NON_BLOCKING = {
    "final_word_weak",
    "first_word_weak",
    "trailing_silence",
    "min_trailing_silence",
    "word_cluster",
    "tail_energy",
    "pre_speech_spike",
    "stacked_words",
    "tts_audio_truncated",
    "tail_zero_duration_run",
    "no_words",
}


def err_check(e):
    if isinstance(e, dict):
        return e.get("type", "?")
    return str(e).split(":")[0].strip()


def main():
    if len(sys.argv) != 2:
        print("usage: recalibrate_failed_to_aligned.py <lang>", file=sys.stderr)
        sys.exit(2)
    lang = sys.argv[1]
    state_path = PACK / f"pipeline_state_{lang}.json"
    backup = PACK / f"pipeline_state_{lang}.json.bak_{int(datetime.datetime.now().timestamp())}"
    state = json.loads(state_path.read_text())

    # Load sibling_languages config — language_leak between siblings is FP
    # per feedback_narration_engine_must_match_speakers + sibling_languages
    # mechanism. With this loaded, the re-validate phase will accept siblings;
    # so language_leak-only-between-siblings is treated as auto-FP here.
    sibling_map = {}
    try:
        import yaml
        y = yaml.safe_load(open(NARRATION_YAML))
        sibling_map = (y.get("validation") or {}).get("sibling_languages") or {}
    except Exception:
        pass
    target_siblings = set(sibling_map.get(lang, []))

    # Load user verdicts (ground truth per feedback_master_rules)
    user_verdicts = {}
    if VERDICTS_FILE.exists():
        raw = json.loads(VERDICTS_FILE.read_text())
        for k, v in raw.items():
            if "_" in k:
                vlang, sid = k.split("_", 1)
                if vlang == lang:
                    verdict = v.get("verdict") if isinstance(v, dict) else v
                    if verdict in ("fine", "broken", "unsure"):
                        user_verdicts[sid] = verdict

    # Backup once (don't overwrite if already exists this second)
    if not backup.exists():
        backup.write_text(json.dumps(state, indent=2, ensure_ascii=False))
    # SIMPLIFIED LOGIC (2026-05-27 after the hi truncated_last_word issue):
    # - Trust the validator. It already has all the per-lang downgrade logic
    #   (Indic-Brahmi, Hebrew, CJK, Gemini-voice, sibling_languages, etc.).
    # - Flip ALL FAILED→ALIGNED unconditionally so re-validate runs them.
    # - The validator will keep truly-broken segs FAILED on its own.
    # - User-verdict=fine override is ONLY for cases where the user wants to
    #   ship a seg the validator would still reject (last-resort operator-trust).
    # - User-verdict=broken means operator says don't ship — leave FAILED.
    flipped_auto = []
    flipped_user = []
    kept_failed = []
    for sid, s in state.items():
        if not isinstance(s, dict): continue
        if s.get("status") not in ("FAILED", "RETRY"): continue
        verrs = s.get("validation_errors") or []
        check_types = {err_check(e) for e in verrs}
        user_v = user_verdicts.get(sid)

        if user_v == "broken":
            # Operator explicitly says don't ship
            kept_failed.append((sid, sorted(check_types), "broken"))
            continue
        if user_v == "fine":
            # Operator says ship despite validator complaint — bypass re-validate
            s["status"] = "VALIDATED"
            s["error"] = None
            s["last_updated"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            flipped_user.append((sid, sorted(check_types)))
        else:
            # No verdict (or "unsure") — flip to ALIGNED and let re-validate
            # judge. With engine=gemini, sibling_languages, Indic-Brahmi,
            # etc. all configured, the validator now correctly handles most
            # FP classes. Anything it still rejects after re-validation is
            # a genuine defect that needs codex auto_rewrite or operator
            # decision.
            s["status"] = "ALIGNED"
            s["error"] = None
            s["last_updated"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            flipped_auto.append((sid, sorted(check_types)))
    state_path.write_text(json.dumps(state, indent=2, ensure_ascii=False))
    print(f"\n  Calibration: {lang}")
    print(f"  ────────────────────────────────")
    print(f"  Backup: {backup}")
    print(f"  Target siblings: {sorted(target_siblings) if target_siblings else 'none'}")
    print(f"  Flipped FAILED→ALIGNED for re-validation: {len(flipped_auto)}")
    for sid, checks in flipped_auto[:10]:
        print(f"    + {sid}  (was: {', '.join(checks)})")
    if len(flipped_auto) > 10:
        print(f"    ... ({len(flipped_auto)-10} more)")
    print(f"  Flipped FAILED→VALIDATED (user verdict=fine override): {len(flipped_user)}")
    for sid, checks in flipped_user:
        print(f"    + {sid}  (was: {', '.join(checks)})")
    print(f"  Kept FAILED (user verdict=broken): {len(kept_failed)}")
    for sid, checks, verdict in kept_failed:
        print(f"    ! {sid}  ({', '.join(checks)})")
    print()


if __name__ == "__main__":
    main()
