# Runbook — 23-language narration of one book by August

Battle-tested on Vol. 1 of the Motorcycles series (2026-05-06). All 23
Chatterbox languages shipped at version 0.1.7 with August voice. Use this
recipe verbatim for Vol. 2–12 and any future August book.

This document captures the **lessons learned**, not just the steps. The
naive "translate → generate → publish per language" path will produce
broken audio in roughly half of segments due to bugs in the upstream
pipeline. Every workaround in this runbook exists because it was needed.

---

## Critical files (read these first)

| File | Purpose |
|---|---|
| `~/encorpora/books/vehicles/motorcycles/01-the-story-of-the-motorcycle/scripts/generate_segments.py` | Reference impl of phonetics machinery (`EN_PHONETICS`, `_spell_year`, `_spell_decade`, `_spell_int`, `apply_phonetics`). Fork per book. |
| `~/encorpora/books/vehicles/motorcycles/01-the-story-of-the-motorcycle/scripts/post_generate_fixup.py` | Post-generate alignment fixer. Re-aligns + energy-onset + shift/extend. **MUST run after every `ttsctl generate`.** |
| `~/encorpora/books/vehicles/motorcycles/01-the-story-of-the-motorcycle/scripts/run_lang_pipeline.sh` | One-command end-to-end per language: validate → generate → fixup → master → audit → publish → patch-catalog. **USE THIS** for every non-EN language. |
| `~/encorpora/corpan/infra/patch-catalog.py` | Restores narrator-redesign fields after every `ttsctl publish`. Mandatory pairing. |
| `~/encorpora/corpan/infra/generate-catalog-assets.py` | One-time: book cover + character avatar/banner via OpenAI gpt-image-1. |
| `~/tmp/voice-previews/cut.sh` | One-time: 5-segment voice preview m4a for the catalog. |

## Critical memory entries (auto-loaded across sessions)

- `feedback_tts_text_divergence.md` — NO DASHES in tts.text; per-book phonetics map
- `feedback_realign_after_trim.md` — re-align + energy onset + shift before publish
- `feedback_publish_then_patch.md` — patch-catalog.py mandatory after publish
- `feedback_codex_parallel_translation.md` — dispatch translations in parallel
- `feedback_malay_reduplication_hyphens.md` — strip in tts.text only

## Critical changelog decision

`~/projects/ttsctl/changelog/decisions/2026-05-06_stale_alignment_after_trim.md`
— full diagnosis of why post_generate_fixup.py exists, with proper
upstream fix options A/B/C.

---

## Phase 0 — Setup (one-time per book)

1. **Manuscript** — write in `manuscript/00-frontmatter.md`,
   `01-chapter.md`, …, `99-backmatter.md`. Sentence rules from
   `~/.claude/agents/book-author.md` (active voice, S-V-O, 5-15 words,
   one idea per sentence, repeat key vocab). For boys 6-15 audience:
   present tense where possible, simple modern register.

2. **`generate_segments.py`** — fork from
   `~/encorpora/books/vehicles/motorcycles/01-the-story-of-the-motorcycle/scripts/generate_segments.py`.
   Update `book_id` and `EN_PHONETICS` for new book's terminology.
   Keep the year/decade/integer auto-spell helpers as-is.
   - **NO DASHES** in any phonetics value (`-` and `—` render as 1s
     pauses in Chatterbox). Use spaces between syllables.
   - Test phonetics by ear before adding entries — speculative entries
     raise risk of new artifacts.

3. **Generate `segments.json`** — `python scripts/generate_segments.py
   manuscript/*.md > packs/<voice>-chatterbox-v1/segments.json`.

4. **`manifest.json`** — `id: book_<series>_<slug>`, `primary_language: en`,
   `version: 0.1.0`, plus series metadata.

5. **`narration.yaml`** — copy retry schedules + mastering from a recent
   pack (e.g. fascinating-curiosities Vol 1). `voices:` map all 23 langs to
   the voice file. Quote `"no"` in YAML (boolean trap). Configure
   per-language validation thresholds (CJK 0.25, RTL 0.15, Indic 0.15,
   Latin 0.12).

6. **Catalog assets** (one-time per character/book):
   - Add new book + character entries to
     `~/encorpora/corpan/infra/generate-catalog-assets.py` (CharacterSpec,
     BookSpec) and run `python generate-catalog-assets.py` to create
     avatar/banner/cover via OpenAI gpt-image-1 (~$0.65 for 3 images).
   - Cut a voice preview: extend `~/tmp/voice-previews/cut.sh` and run.
     Upload to `s3://corpan-prod/artifacts/voice-previews/<voiceId>.m4a`.
   - Update `~/encorpora/corpan/infra/patch-catalog.py`:
     `CHARACTERS_META[<voiceId>]`, append to `VOICE_PROFILES`, add to
     `VOICE_PREVIEW_URLS`, add to `BOOK_META`.

7. **Sanity check** — `ttsctl status <pack> --lang en` should report all
   PENDING with the right segment count.

---

## Phase 1 — Ship EN (gate language)

Run the full per-language pipeline. EN is the gate — listen-test before
moving on.

```bash
# Generate
ttsctl generate <pack> --lang en --device cuda > /tmp/gen_en.log 2>&1
# Iterate until 0 FAILED, 0 PENDING

# Fixup (re-align post-trim, energy onset, shift/extend)
python <scripts>/post_generate_fixup.py <pack> en

# Master rebuilds audio_manifest from corrected alignment
ttsctl master <pack> --lang en --all

# Audit must be clean
ttsctl audit <pack> --lang en

# Publish + patch
ttsctl publish <pack> --lang en --voice-id <vid> --tier public --version 0.1.0
( cd ~/encorpora/corpan/infra && python patch-catalog.py )
```

**User listen-test EN samples** before unleashing the rest:
- Frontmatter (ch00-002), one mid-chapter sentence
- All 7 chapter closers (the "next chapter" / volume preview lines)
- Any segment that hit token-repetition or long-tail warnings during gen
- All 4 specific defect classes from the original motorcycles run:
  - Truncated final-s words
  - Doubled-segment / repetition artifacts
  - Foreign loan-word pronunciation (Reitwagen-style)
  - Letter-spelled abbreviations (BMW-style)

If EN fails A+, iterate the EN_PHONETICS map / regenerate affected
segments / republish. **Do not light up GPU on other languages until EN
sounds right** — fixing 22 other packs after the fact is much more work.

---

## Phase 2 — Dispatch all 22 codex translations in parallel

Single message, multiple Agent tool calls with `subagent_type=codex` and
`run_in_background=true`. They produce text artifacts independently and
land asynchronously. Total wall time ~5–20 min per agent; all 22 typically
complete within 30 min.

**Codex prompt template** (the one that worked, ~250-400 words each):

```
Translate motorcycles EN segments to <Language> (<lang>) using the same
pattern as the FR translation that just shipped.

Read first:
- segments.json (170 segs)
- segments_fr.json (model)
- phonetics_fr.json (shape)

Output:
- segments_<lang>.json
- phonetics_<lang>.json

Schema: identical to segments_fr.json — 170 segs, IDs match,
language="<lang>", display + tts.text per segment, pause/repetition
carried.

Hard rules:
- NO DASHES in tts.text (Chatterbox = ~1s pause)
- NO Arabic numerals in tts.text
- 170 segs, IDs match
- Headings get text only, no tts

<Language>-specific phonetics:
- BMW → "<phonetic>"
- Reitwagen → "<phonetic>"
- R75 → "<phonetic>"
- CB 750 → "<phonetic>"
- ZX-11 → "<phonetic>"
- WLA → "<phonetic>"
- (other proper nouns)

Years <Language>: 1885 → "<spelled>". 1902 → "<spelled>". 1960s →
"<idiomatic>". (test compound vs spaced — use spaced if Chatterbox
mangles long native compounds)

Cardinals: 7, 100, 120, 175, 194, 200, 100 million → spelled.
"miles per hour" → "<localised>".

Audience: boys 6-15 learning <Language>. Friendly, simple, present tense.

Report: paths, divergent count, judgment calls.
```

The FR pattern is the strongest baseline — refer codex to it directly.

**Cohort order (validated default):**
- Tier 1 (user-gate): EN → FR → ZH
- Cohort 1: es, de, it, pt, ru, ja
- Cohort 2: ko, ar, hi, tr
- Cohort 3: nl, pl, sv, da, fi, el, ms, "no", sw, he

---

## Phase 3 — GPU pipeline cohorts (sequential per language)

After EN/FR/ZH gate, the rest run unattended via:

```bash
SCRIPTS=~/encorpora/books/vehicles/motorcycles/01-the-story-of-the-motorcycle/scripts
(
for L in es de it pt ru ja; do
  echo "[$(date +%T)] starting $L"
  "$SCRIPTS/run_lang_pipeline.sh" "$L" 0.1.7 || { echo "$L FAILED, continuing"; }
done
echo "[$(date +%T)] cohort done"
) > /tmp/run_cohort1.log 2>&1
```

`run_lang_pipeline.sh` does for each language:

1. Pre-flight validation (170 segs, IDs match, no digits in tts, no dashes
   in tts, no untranslated passthrough). **Fails fast** if codex emitted
   bad JSON — saves a 25-min GPU loop.
2. `ttsctl generate --lang <L> --device cuda`
3. `post_generate_fixup.py <pack> <L>` (re-align + energy onset + shift/extend)
4. `ttsctl master --all`
5. `ttsctl audit`
6. `ttsctl publish` at the configured version
7. `patch-catalog.py`

**Per-language wall time:** ~25–28 min for ~160 segments on the GB10. RU
+ JA may run a bit longer due to retry pressure.

**Memory note:** project memory says "4–6 langs per GPU batch, restart
between batches." In practice each language is a fresh Python process;
memory is reclaimed cleanly. Vol. 1 ran 6 then 14 langs back-to-back with
no GPU-memory issue. If you see OOM-class failures, drop to 4 per batch.

**Pre-flight failure recovery:** if validation fails, the script prints
exactly which segments and which rule failed (digits / dashes / passthrough).
Fix the JSON in place and re-run — the script picks up cleanly.

---

## Known gotchas (every one of these bit us)

1. **Stale alignment** (the big one) — handled by post_generate_fixup.py.
   See `feedback_realign_after_trim.md`.
2. **`ttsctl publish` strips narrator-redesign fields** — patch-catalog.py
   mandatory after every publish. See `feedback_publish_then_patch.md`.
3. **Chatterbox treats `-` and `—` as 1s pauses** — strip from all
   tts.text. Display can keep dashes (Harley-Davidson, ZX-11, etc.).
4. **Forced alignment misplaces letter-spelled foreign words** — "BMW" in
   audio "Bay Em Vay" gets a 0–60ms timestamp because Whisper can't anchor
   "B M W" letters to spoken-letter syllables. Energy-based onset
   detection (NOT free-form Whisper, which compresses these to "Pemvey"
   at a late time) is the fix.
5. **Whole-segment alignment shift on quiet pre-speech** — Chatterbox
   sometimes emits 200–700ms of low-RMS audio before the loud syllable;
   forced alignment places the first word late and the rest of the
   alignment shifts uniformly. The fixup script's whole-seg shift
   (delta = forced_first - energy_onset) corrects all words, not just the
   first.
6. **Malay reduplication hyphens** — `berjuta-juta`, `kira-kira` etc. are
   morphological. Display keeps them; tts.text strips to space. See
   `feedback_malay_reduplication_hyphens.md`.
7. **YAML "no" boolean trap** — Norwegian language code parses as
   boolean `false` in unquoted YAML. Quote it.
8. **Hebrew `dicta_onnx` is missing** in our venv. Hebrew vowel inference
   falls to Chatterbox alone — acceptable for kids' content like
   motorcycles, NOT acceptable for Genesis-class biblical Hebrew. Listen
   first on any new HE pack.
9. **Russian `russian_text_stresser` is missing** — minor stress drift
   on rare names; acceptable for kids' content.
10. **Codex sandbox quirk** — some codex invocations report
    `sandbox: read-only` even with right flags. Codex falls back to
    writing a builder script in `/tmp/<lang>_build/build_<lang>.py` and
    running it locally. Both paths produced valid output for all 22 langs.

---

## Costs (Vol. 1 reference)

- **Catalog assets**: ~$0.65 OpenAI gpt-image-1 per book (3 images:
  cover + character avatar + character banner).
- **Translations**: $0 (codex local, free).
- **Audio gen**: $0 (local GPU).
- **Total $0.65 in cloud cost** for a full 23-language ship.

Wall time, end-to-end (skilled operator):
- Phase 0 setup: ~2 hours (manuscript writing dominates)
- Phase 1 EN ship + ear-test: ~1 hour
- Phase 2 codex translations: ~30 min wall time (parallel)
- Phase 3 GPU pipeline: ~9 hours for 22 languages (≈25 min × 22 sequential)
- **Total ≈ 12-14 hours** to take a new book to 23 narrations live on CDN.

---

## Verification checklist

After all 23 languages publish:

```bash
curl -s 'https://d38iwc9748jekz.cloudfront.net/catalog-v2.json?nc='$(date +%s) \
  | jq '[.narrations[] | select(.bookId=="<your_book_id>") | .language] | sort | unique'
# → should be the 23 codes

# Catalog has 3+ characters
curl ... | jq '.characters | length'   # ≥3

# Voice profile shows all 23 langs supported
curl ... | jq '.voiceProfiles[] | select(.id=="<voiceId>") | .supportedLanguages | length'
# → 23

# Each narration has characterId + coverImageUrl
curl ... | jq '.narrations[] | select(.bookId=="<your_book_id>") | {language, characterId, coverImageUrl}'
# → all populated, no empty strings
```

Spot-listen at minimum:
- 1 segment from each of 5 random languages
- The 4 originally-flagged defect classes in EN
- Any language flagged by a codex judgment-call note

---

## When this runbook is wrong

Vol. 1 was Sept 2026 work. If you're reading this in 2027+:
- Has ttsctl learned the catalog schema? → patch-catalog.py may be
  unnecessary. Test by publishing without it; check catalog characters[]
  and books[] still populated after. If yes: drop patch from the runbook.
- Has the Align-after-Trim bug been fixed upstream? → `post_generate_fixup.py`
  may produce no-op output. Test by running it on a fresh pack and seeing
  if any words actually shift. If no: drop the script from the runbook.
- Have new languages been added to Chatterbox? → extend the cohort list,
  the codex prompt template, the narration.yaml voices map.

When you fix something durably upstream, **delete the corresponding section
of this runbook**. The point is to retire workarounds as they become
obsolete, not to accumulate them.
