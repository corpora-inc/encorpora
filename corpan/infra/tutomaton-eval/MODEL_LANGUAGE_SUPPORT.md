# Tutomaton — per-model language support (which size teaches which languages)

_Last set 2026-06-16 by directly reading each model's real output._

Tutomaton ships three on-device model sizes (RAM-tiered). The 4B teaches all 50
shipped languages; the smaller models teach fewer. The **source of truth** is
`corpan/packs/tutomaton/src/modelTiering.ts` (`ModelSpec.supportedLanguages`);
`undefined` = inherit the full offered set (the 4B). This file records the
findings + the methodology, because we got the method wrong twice first.

## Result

| Model | # langs | Notes |
|---|---|---|
| **Qwen3-0.6B** | **12** | major Romance/Germanic + Chinese/Cantonese/Thai/Indonesian |
| **Qwen3-1.7B** | **34** | + all European Slavic/Nordic + Arabic/Hebrew/Farsi/Japanese/Turkish/Vietnamese/Malay |
| **Qwen3-4B** | **50** | all shipped languages (`supportedLanguages: undefined`) |

Monotonic by construction: **0.6B ⊆ 1.7B ⊆ 50**.

**0.6B (12):** en, es, fr, id, nl, pt-BR, pt-PT, ru, th, yue-Hant-HK, zh-Hans, zh-Hant

**1.7B (34):** ar, ca, cs, da, de, en, es, fa, fr, he, hr, hu, id, it, ja, ms, nl,
no, pl, pt-BR, pt-PT, ro, ru, sl, sr, sv, th, tr, uk, vi, yue-Hant-HK, zh, zh-Hans, zh-Hant

**Cut from the small models (and why — observed in the actual replies):**
- **0.6B cuts ~38:** dodges into English (bn, gu, hi, ja, kn, ko-polite, mr, ne,
  sr, ta, ur…), garbles (cs, el, lt, bg, sk), wrong-language drift (ca→Spanish,
  de→Dutch), fabricated greetings (da, no, sv, ro), and outright script garbage
  for `ms` (emitted Georgian/Lao glyphs). `zh` (generic) answered in English even
  though `zh-Hans`/`zh-Hant`/`yue` were solid.
- **1.7B cuts 16:** bg, bn, el, fi, gu, hi, kn, ko-polite, lt, mr, ne, pa-Guru,
  sk, ta, tl, ur — real repetition loops, fabricated/garbled words, or
  answering ≥half in English. (Tagalog also drifted into Cebuano.)

The 4B produces genuine, in-script output for the hard set (Bengali, Hindi,
Tamil, Kannada, Marathi, Nepali, Gujarati, Korean, Japanese, Urdu) — rough in
spots (odd greeting translations) but real, usable language, not garble. So it
keeps all 50. (Note: the 50 already excludes te/sw/su/jv/pa-Arab, dropped from
the 4B in the 0.6.0 eval — see `tutomaton-qwen-language-support`.)

## Methodology — and three ways NOT to do it

The data: each model was run over the harness's 6-prompt battery at the shipped
**conservative config** (temp 0.3) in **non-thinking mode** for the hybrids
(`TUTO_EVAL_NOTHINK=1`), producing `results-0.6b/`, `results-1.7b/`, and the 4B's
`results/rows.jsonl`. Samples were consolidated one-per-prompt per language into
`/tmp/gate/{06b,17b,4b}.md` and **read directly, with one consistent bar**.

**The bar:** KEEP if the model RELIABLY produces fluent, correct, in-script
target language a learner could trust. A single minor slip (one wrong word, one
off greeting) does NOT disqualify. CUT only for FREQUENT wrong-language /
garbled-or-fabricated words / romanization / repetition loops / English-dodging.

### What failed (do not repeat)
1. **Objective langid + in-script metric** over-counts: it scores "correct
   script + detected language" at ~100% for languages the model actually
   garbles (script-correct ≠ real language), and conversely can't see
   English-dodging well. Useful as a coarse floor, not a gate.
2. **A cheap LLM judge (gpt-4o-mini)** is just noise: it failed *perfect* Italian
   and Spanish, and — because it answered in the target language ("Sí", "Ja") —
   a naive `startswith("y")` parse cut everything but English/Malay. Even with a
   digit-only parse it was unreliable.
3. **A panel of many subagents** is inconsistent ACROSS agents: with a binary
   keep/cut rubric on ~8 samples, one agent kept `zh` while another cut
   `zh-Hans` (same language); the harsh pass cut **German, Polish, Portuguese,
   and Simplified Chinese from the 4B** (absurd — Qwen3 is a Chinese model) on
   "2 of 12 replies had English," which other agents tolerated. Different agents,
   different thresholds → garbage at the boundary.

### The lesson
To judge multilingual quality, **read the actual output yourself with one
consistent bar** — not a cheap API, not regex/langid, not a panel of agents that
each calibrate differently. The over-cutting failure mode is specific: a binary
judge on a tiny sample will reject a language the model handles fine because of a
single greeting slip (Polish "dobry wieczór" for "good morning"). Reading the
full set of replies makes the real picture obvious (Polish/Swedish/Czech are
clearly fluent; Tamil/Hindi on the small models are clearly looping garbage).

## Re-running
```
cd corpan/infra/tutomaton-eval
# (re)generate samples for a model, non-thinking for hybrids:
TUTO_EVAL_MODEL=/path/to.gguf TUTO_EVAL_NOTHINK=1 TUTO_EVAL_RESULTS=$PWD/results-<tag> \
  .venv/bin/python run.py triage
# then consolidate one-reply-per-prompt per language and READ them.
```
