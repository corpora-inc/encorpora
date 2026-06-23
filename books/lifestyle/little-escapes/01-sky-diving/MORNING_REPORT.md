# Skydiving — Morning Report (2026-04-27)

Pack: `/home/skyl/encorpora/books/lifestyle/little-escapes/01-sky-diving/packs/ian-chatterbox-v1`
Voice ID: `ian-chill-clear`
Tier: public (free)

## TL;DR

You found real defects in production-shipped IT and PT (mid-word truncations + pre-speech clicks). Investigation: the validators were either silenced by the short-utterance non-blocking calibration (false negatives in 5/5 cited end-defects) or had FN coverage gaps (`pre_speech_spike` skipped when first word starts ≤80ms; peak threshold too high). Pipeline orchestration was correct — no `--force` and no plateau-accept escape paths reached the audio. The bug was in the *thresholds* and *suppressions* the validators used.

Three code fixes landed tonight:
- **Fix A**: Removed the short-utterance non-blocking calibration entirely. Every spoken segment validates equally, no exceptions.
- **Fix B**: Added Silero VAD as a second source of truth on word-end timing. Two new blocking errors: `tts_audio_truncated` (audio ends mid-utterance per VAD) and `whisper_alignment_undershoot` (VAD says speech continues past Whisper's last word). 5/5 cited defects fire correctly. 0/9 false positives on clean controls.
- **Fix C**: `pre_speech_spike` — dropped the 80ms start-time guard, scan from t=0, lowered peak threshold to 0.05 (provisional).

What's NOT done tonight (deliberately, per your "perfection over rushing" instruction):
- Mass resync + republish. The audit shows ~943 segments would now flag dirty across 11 shipped languages — too many to mass-resync without first ear-validating the new threshold values. Resync built on un-calibrated thresholds would burn cycles on retries that may not produce real quality improvement.
- Restart of the 12 killed in-flight generates. Same reason — they'd run under provisional thresholds.

What you have to do in the morning:
- **Ear-grade the calibration corpus**. 213 samples across 11 languages, stratified into 4 classes (5 of each defect type + 5 clean controls). Listen, mark `verdict: PASS|FAIL|BORDERLINE`, return.
- I write `calibrate_fit.py` against your verdicts. Per-(lang, voice) thresholds get set. Then we audit, resync, restart-the-12, republish.

## What's live in production

11 languages, all v0.1.0 except EN (v0.1.1):

| Lang | Version | Notes |
|---|---|---|
| en | 0.1.1 | shipped earlier in the night with 5 ch01-013/ch02-070/ch06-345/etc. fixes |
| es | 0.1.0 | |
| fr | 0.1.0 | |
| de | 0.1.0 | |
| pt | 0.1.0 | **has known defects** (your reported clicks + ch05-289 cut) |
| it | 0.1.0 | **has known defects** (your reported pops + 4 cut endings) |
| ar | 0.1.0 | |
| nl | 0.1.0 | |
| el | 0.1.0 | |
| tr | 0.1.0 | |
| sv | 0.1.0 | |

12 languages remaining (da, fi, he, hi, ja, ko, ms, no, pl, ru, sw, zh): translations are complete (validated strictly by codex agents). Audio generation was killed mid-cycle when the broken short-utterance calibration was identified. They'll be regenerated under the calibrated validators after the morning ear-grading session.

## Audit results (under new validators, provisional thresholds)

`/home/skyl/pipelines/skydiving-overnight/audit_blocking.py` rerunnable anytime.

| Lang | DONE | history_dirty | endpoint_dirty | unique dirty |
|---|---:|---:|---:|---:|
| en | 368 | 85 | 92 | 140 |
| es | 368 | 66 | 26 | 81 |
| fr | 368 | 93 | 53 | 120 |
| de | 368 | 97 | 71 | 128 |
| pt | 368 | 58 | 44 | 77 |
| it | 368 | 58 | 24 | 70 |
| ar | 368 | 29 | 13 | 38 |
| nl | 368 | 69 | 50 | 94 |
| el | 368 | 56 | 13 | 60 |
| tr | 368 | 19 | 15 | 32 |
| sv | 368 | 76 | 52 | 103 |
| **TOTAL** | **4048** | **706** | **453** | **943** |

`history_dirty` = had blocking errors in retry_history's last attempt that the old short-utt suppression silenced.
`endpoint_dirty` = newly flagged by `validate_endpoints` (Silero VAD cross-check).
`unique` = union of the two.

## Calibration corpus — explicit file paths to ear-grade

```
/home/skyl/projects/ttsctl/calibration/skydiving_ian-chill-clear/calibration_ar.json
/home/skyl/projects/ttsctl/calibration/skydiving_ian-chill-clear/calibration_de.json
/home/skyl/projects/ttsctl/calibration/skydiving_ian-chill-clear/calibration_el.json
/home/skyl/projects/ttsctl/calibration/skydiving_ian-chill-clear/calibration_en.json
/home/skyl/projects/ttsctl/calibration/skydiving_ian-chill-clear/calibration_es.json
/home/skyl/projects/ttsctl/calibration/skydiving_ian-chill-clear/calibration_fr.json
/home/skyl/projects/ttsctl/calibration/skydiving_ian-chill-clear/calibration_it.json
/home/skyl/projects/ttsctl/calibration/skydiving_ian-chill-clear/calibration_nl.json
/home/skyl/projects/ttsctl/calibration/skydiving_ian-chill-clear/calibration_pt.json
/home/skyl/projects/ttsctl/calibration/skydiving_ian-chill-clear/calibration_sv.json
/home/skyl/projects/ttsctl/calibration/skydiving_ian-chill-clear/calibration_tr.json
```

Each file has ~20 stratified samples:
- 5 from each of: `tts_audio_truncated`, `whisper_alignment_undershoot`, `history_dirty`, `CLEAN`
- (Some langs short — el has only 2 `tts_audio_truncated` candidates, ar has 4)
- ~213 samples total across 11 langs

Each sample row:
```json
{
  "seg_id": "ch03-134",
  "wav_path": ".../audio/it/wav/ch03-134.wav",
  "m4a_path": ".../audio/it/ch03-134.m4a",
  "metrics": {
    "whisper_last_word_end_ms": 920,
    "vad_speech_end_ms": 1598,
    "audio_duration_ms": 1840,
    "endpoint_errors": ["whisper_alignment_undershoot"],
    "history_blocking_errors": ["trailing_silence", "tail_energy"]
  },
  "classification": "whisper_alignment_undershoot",
  "verdict": null,
  "verdict_notes": null
}
```

You listen → set `verdict` ∈ {`PASS`, `FAIL`, `BORDERLINE`} → save. Then I write `calibrate_fit.py` against the verdicts and the per-(lang, voice) thresholds land in `narration.yaml`. Then we resync + republish. Acceptance bar (per your instruction): zero observed FP and zero observed FN on the labeled corpus.

## Code changes in summary

Files modified:
- `~/projects/ttsctl/ttsctl/validator.py` — Fix A (deletes), Fix B (`validate_endpoints`, `tts_audio_truncated`, `whisper_alignment_undershoot`), Fix C (`pre_speech_spike` recalibration). All errors registered in `retry_triggers` and `ERROR_SEVERITY`.
- `~/projects/ttsctl/ttsctl/vad.py` (new) — Silero VAD wrapper.
- `~/projects/ttsctl/ttsctl/pipeline.py` — calls `validate_endpoints`, persists endpoints to `seg_state.endpoints`.
- `~/projects/ttsctl/ttsctl/state.py` — adds `endpoints` field to SegmentState.
- `~/projects/ttsctl/ttsctl/config.py` — adds `whisper_alignment_undershoot_ms` (default 500) and `tts_audio_truncated_min_fade_ms` (default 50). Both provisional; calibration replaces them per-(lang, voice).

Changelog entries (4):
- `~/projects/ttsctl/changelog/decisions/2026-04-27_drop_short_utterance_non_blocking.md`
- `~/projects/ttsctl/changelog/decisions/2026-04-27_vad_word_end_cross_check.md`
- `~/projects/ttsctl/changelog/decisions/2026-04-27_pre_speech_spike_recalibration.md`
- `~/projects/ttsctl/changelog/decisions/2026-04-27_per_lang_voice_calibration_framework.md`

## Pipeline support scripts (new)

- `~/pipelines/skydiving-overnight/audit_blocking.py` — walks pipeline_state files, runs new validators, reports dirty seg counts per language.
- `~/pipelines/skydiving-overnight/calibration_sample.py` — generates the stratified ear-test corpus.
- `~/pipelines/skydiving-overnight/validate_translation.py` — strict per-segment translation validator (from earlier in the night, used for codex translations).

## Open follow-ups (not blocking morning)

- **Fix B+ (multi-day)**: replace stable-whisper DTW alignment with wav2vec2-CTC forced alignment. VAD answers the trim/truncation question well; word-by-word reader highlighting needs phoneme-level precision that wav2vec2-CTC provides. Especially relevant for AR/HE/CJK/morphologically-complex languages where Whisper's DTW-on-attention is weakest.
- **`calibrate_fit.py`**: TP-rate-maximizing threshold finder under FP=0 constraint, given the labeled corpus. Write after first verdict batch arrives.
- **`narration.yaml validation.per_lang_voice`** schema + reader: lets per-pack threshold overrides land cleanly.
- **Trimmer integration with VAD**: trimmer currently obeys Whisper. Could use `max(whisper_end, vad_end) + grace`. Only matters for segments that pass `whisper_alignment_undershoot` but where VAD-end is still slightly past Whisper-end. Lower priority since the validator catches the dangerous cases.

## Things you said tonight that the architecture absorbed

- "We need to stop extrapolating calibrations from N=6 of one segment class to all segment classes in all languages." → captured as architecture rule; Fix A removed the offender.
- "Don't use re-validation after trim as a workaround for whisper alignment errors. Address the cause with a second source of truth." → Fix B does exactly this.
- "Persist both endpoints explicitly in manifests so we can compare against future aligners." → `seg_state.endpoints` now first-class data.
- "Don't hardcode 100ms — make the threshold configurable per (lang, voice)." → `ValidationThresholds` got the new fields; per-(lang, voice) overrides land via Fix D.
- "Zero observed FP/FN on a sufficiently powered labeled corpus." → calibration framework's acceptance bar.
- "Perfect the pipeline rather than rush to production." → mass resync deferred until thresholds are calibrated, not provisional.
