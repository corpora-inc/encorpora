# AI This Week — Language Pitfalls Registry

Accumulating per-language tunings, observed failure modes, and
recommended pipeline config. Each entry written after a (book, lang)
pair runs through the pipeline. New issues should READ this file
BEFORE running translation/generation on any of these languages —
the right answer was already paid for.

Machine-readable data lives in `lang_records/<lang>.jsonl` (one record
per issue × lang). Read both in tandem.

## Tiers (issue 1 data, May 14 2026)

### Tier A — clean, ship as-is via Gemini default (cost ≤ 1.10× baseline)

en, es, fr, de, it, pt, ja, ko, zh, ar, hi, ru, nl, pl, tr, sv, da,
no, fi, el, he, ro, id, vi, fa, hu, cs, hr, ca, sl, sk, ar, fa, ru, zh

- Gemini-2.5-flash text translation: ✅
- Gemini-3.1-flash-tts: ✅
- Whisper-large-v3 alignment: ✅
- Default `narration.yaml` config works

### Tier B — clean after one fix (1.10×–1.30×)

| Lang | Issue | Fix shipped |
|---|---|---|
| ms | ch00-061 "Anytime, Vindy." kept language-leaking | Rewrote to "Bila-bila masa, Vindy." (Malay-first opener) |
| ja | 5 long multi-sentence segments kept truncating | Hand-shortened to <100 chars each |
| sw | High first_word_weak + too_long on Swahili | auto_rewrite resolved; expensive but converged |
| bg | ch00-015 "Anything else worth flagging?" loop-truncated | Rewrote to "Какво друго заслужава внимание?" (different structure) |

### Tier C — translate-passthrough, need `--provider claude`

Gemini-2.5-flash returns English unchanged for these languages. The
translator's refusal guard catches this. ALWAYS use `--provider claude`
(or openai) for first translate.

ta (Tamil), te (Telugu), gu (Gujarati), kn (Kannada),
ur (Urdu), th (Thai)

After Claude translate, Gemini TTS handles all 6 fine.

### Tier D — Indic langs where Whisper alignment may be over-flagging

bn (Bengali), mr (Marathi), ne (Nepali)

- **Symptom**: `tail_zero_duration_run`, `tts_audio_truncated`,
  `stacked_words` flagged at very high rates (bn: 58+59+58 across
  retry history). Gemini audio itself may be FINE — sample bn
  ch00-004 audio was 24s of clear Bengali speech; Whisper-large-v3
  free-transcribed the start cleanly then trailed into garble on the
  same audio. Suggests Whisper-large-v3 Bengali decoding is weak on
  longer utterances, NOT Gemini truncation.
- **NOT a Chatterbox option:** Chatterbox supports only 23 langs;
  bn/mr/ne are not on that list. Forget that path.
- **MMS is the right cross-check.** Adapter codes for bn/mr/ne (+
  ta/te/gu/kn/ur/th) added to `ttsctl/asr_mms.py MMS_ADAPTER` on
  2026-05-14. Now Tier-2 ASR verification will fire on these langs:
  when Whisper says "audio truncated", MMS gets to disagree.
- **Likely next steps**:
  1. Re-run a few bn/mr/ne segments — MMS cross-check should
     down-grade many `tail_zero_duration_run` flags
  2. Swap MMS as PRIMARY aligner for Indic langs (deeper change —
     stable_whisper alignment uses Whisper internals; MMS would
     need a CTC-based forced-alignment path in `aligner.py`)
  3. Shorter source segments (Ep 2's one-sentence-per-segment rule
     should naturally avoid the long-utterance failure mode)

## Key validators by language

| Validator | Why it matters | Lang sensitivity |
|---|---|---|
| `language_leak` (severity 200, FATAL) | Whisper auto-detect ≠ target. Catches Gemini rendering in EN instead of target. | High on mr, ne, sk (6+); appears once on ms. Never on en/es/fr/de etc. |
| `tts_audio_truncated` + `tail_zero_duration_run` | Gemini cut audio mid-utterance | Catastrophic on bn (58+59), mr (9), ja (14 before fix). Rare on Latin/Cyrillic. |
| `too_long` | Audio longer than expected for text. Often false-positive on slow-prosody langs | Triggers on ja (29), ko (23), bg (21), sw (16) — high but harmless if no other errors |
| `first_word_weak` | Soft onset; tighter threshold for Gemini in narration.yaml | Hits in ALL langs ~15-35 times per pack; mostly resolved by retry |

## Translation provider routing (recommended defaults)

```python
# In future: extend `ttsctl translate` to auto-select provider per lang.
# Until then, do this by hand:
PROVIDER_BY_LANG = {
    # Always Claude — Gemini-flash passes through EN:
    "ta": "claude", "te": "claude", "gu": "claude", "kn": "claude",
    "ur": "claude", "th": "claude", "ja": "claude",  # ja worked w/ claude but pass-through happened on first try
    # All others: Gemini-flash works.
}
```

## What to capture every issue (going forward)

1. **lang_records/<lang>.jsonl** — append one record per issue:
   - cost_ratio (gemini_tts_calls / 62)
   - rewrites_per_seg
   - error_class_counts (full)
   - translator_used
   - final_status
   - human_intervention_notes (optional, qualitative)

2. **LANG_PITFALLS.md updates** — promote anything surprising to
   the tier table above. Demote anything that turned out fine.

3. **Per-(book,lang) thresholds** in narration.yaml only when a
   calibration corpus justifies it. Don't extrapolate.
