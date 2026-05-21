# Narration Pipeline State — 2026-05-19

## What's Running RIGHT NOW

Nothing. All processes stopped. Production is clean.

## Catalan rollout — paused after 3 books (2026-05-19)

Shipped 3 mono-narrator `gemini-ron` packs to `tier=public`:

| book | segs | pack | version |
|---|---|---|---|
| tolstoy-short-stories/three-questions | 82 | ron-gemini-v1 | 0.1.0 |
| food-of-the-world/01-soul-food | 148 | ron-gemini-v1 | 0.1.0 |
| vehicles-of-the-world/01-the-story-of-the-train | 154 | ron-gemini-v1 | 0.1.0 |

Strategy: Chatterbox does not support Catalan, so Chatterbox-only
books get a parallel new `ron-gemini-v1` pack with voiceId
`gemini-ron`. The existing Chatterbox pack is untouched. See
`~/projects/ttsctl/changelog/decisions/2026-05-19_catalan_rollout.md`
for the full recipe + the language-leak anti-pattern.

Per-series records in
`<series>/lang_records/ca.jsonl` (Tolstoy, food-of-the-world,
vehicles-of-the-world). Cross-series pitfalls registry in
`~/encorpora/books/tech/ai-this-week/LANG_PITFALLS.md` (Tier A*
section for ca).

Queue remaining: see the changelog. Default next move per book is in
the plan at `~/.claude/plans/it-sounds-amazing-let-s-tender-twilight.md`.

## Recent Incident — voice-id natural-key violation (2026-04-25)

A prior agent session's `/tmp/realign_remaining.sh` hardcoded `--voice-id ian-narration` for every soccer book × every lang. Same disease in `~/bin/realign-catalog.py` (one-voice-per-book hardcoded). The natural key for a narration is **(bookId, language, voiceId)** — multiple voices per (book, lang) are valid — and IDs forming that key MUST be read from the live catalog, never fabricated.

Result: 73 v0.2.0 zips uploaded with wrong `voiceId`, of which 53 were phantom duplicates beside the original `ian-chill-clear` entries.

Recovery done in this session:
- Stopped all in-flight jobs.
- Republished all 73 langs at **v0.2.1** using the canonical original voiceId per (book, lang) — same audio, correct metadata. Catalog upserted by ID, so v0.2.1 either replaced the v0.1.x `ian-chill-clear` entry or replaced the v0.2.0 `ian-narration` entry depending on the original.
- Nuked 73 v0.2.0 zips from S3 + 53 phantom catalog entries from `catalog-v2.json` and `catalog.json`. CloudFront invalidated.

Verified clean: 82 soccer narrations, 0 (book, lang) duplicates. 73 at v0.2.1, 9 still at v0.1.x (the langs we never finished realigning — see below).

Memory rule added: `~/.claude/projects/-home-skyl/memory/feedback_voice_id_immutable.md`.

## Catalog Status

### Three Questions (Три вопроса) — ALL 23 LANGS AT v0.2.0 ✓
- Pack: `~/encorpora/books/literature/tolstoy-short-stories/three-questions/packs/ian-chatterbox-v1`
- Realigned with large-v3, published, clean

### What Men Live By (Чем люди живы) — RU, EN, ES AT v0.2.0
- Pack: `~/encorpora/books/literature/tolstoy-short-stories/what-men-live-by/packs/ian-chatterbox-v1`
- 20 more languages have translations but NO TTS audio yet
- Premium tier, product_id: `corpan.book.tolstoy_what_men_live_by`

### Soccer Books — 92/92 COMPLETE (2026-04-26)
- Goalie:   23/23 ✓ (he v0.2.2 with nikkud)
- Sweeper:  23/23 ✓ (he v0.2.1 — original had nikkud)
- Defender: 23/23 ✓ (he v0.2.2 with nikkud)
- Striker:  23/23 ✓ (he v0.2.1 with nikkud)
- Voice IDs (mixed per natural key): `ian-narration` for en/es/de/fr/it/pt; `ian-chill-clear` for the rest.
- Hebrew recovery story: original 3 books shipped without nikkud, Chatterbox produced unreliable Hebrew audio. Solution: `~/bin/add-nikkud-to-tts.py --fields=both` adds nikkud to text+tts.text; resync regenerates audio with proper pronunciation.
- Validator calibrations this session: CJK (final/first_word_weak, trailing_silence non-blocking), short-utterance (≤7w/≤3500ms — energy checks non-blocking), Hebrew (10 alignment-dep checks non-blocking; pure waveform checks remain blocking).

## CRITICAL: Japanese (and CJK) Calibration Needed

### Human ear data from Goalie JA:
- `final_word_weak` alone at score 20 = FALSE POSITIVE (4/4 passed ear check)
- ch06-423 with 67% zero-duration words = CATASTROPHIC FAIL (correctly caught by multiple validators but scored only 20 when it should be 200+)
- See: `~/projects/ttsctl/changelog/decisions/2026-04-25_ja-final-word-weak-calibration.md`

### Action needed:
1. For JA/CJK: either disable `final_word_weak` as a publish-blocker or raise threshold from 0.50x to 0.30x
2. Add zero-duration percentage as a hard score override (>30% zeros = catastrophic)
3. Clear the 23 false-positive `final_word_weak` segments in Goalie JA so they can publish
4. Resync ch06-423 (the real failure)
5. Apply same pattern to other languages with high false-positive counts

## Pipeline Code Changes Made This Session

All in `~/projects/ttsctl/ttsctl/`:
- `validator.py`: added `truncated_last_word` check (0 false positives validated)
- `validator.py`: added `post_speech_pop` check (0 false positives validated, 5.0x threshold calibrated with human ear)
- `config.py`: `whisper_model` changed from `"medium"` to `"large-v3"` (0% zero-duration vs 46% on test segment)
- `pipeline.py`: trim safety guard (>30% zero-duration alignment → skip trim to protect audio)

Changelog entries in `~/projects/ttsctl/changelog/decisions/`:
- `2026-04-23_truncated-last-word-check.md`
- `2026-04-23_post-speech-pop-check.md`
- `2026-04-24_whisper-large-v3-alignment.md`
- `2026-04-24_no-force-policy.md`
- `2026-04-25_set-e-kills-batch-jobs.md`
- `2026-04-25_ja-final-word-weak-calibration.md`

## FULL CATALOG — Realignment Status with Whisper large-v3

| Book | Pack Path | Langs | Segs/Lang | v0.2.0 Status |
|------|-----------|-------|-----------|---------------|
| Three Questions | `.../three-questions/packs/ian-chatterbox-v1` | 23 | 81 | ✓ ALL 23 DONE |
| What Men Live By | `.../what-men-live-by/packs/ian-chatterbox-v1` | 3 | 617 | ✓ RU,EN,ES done. 20 langs need TTS generation first |
| Goalkeeper | `.../u10-7v7-soccer/02-goalie/pack` | 23 | 633 | 11 done, 12 in progress. JA has 24 FAILED (see calibration) |
| Sweeper | `.../u10-7v7-soccer/03-sweeper/pack` | 23 | 613 | 11 done, 12 in progress |
| Defender | `.../u10-7v7-soccer/04-defender/pack` | 23 | 557 | In progress |
| Striker | `.../u10-7v7-soccer/05-striker/pack` | 13 | 611 | In progress |
| Volcanoes | `.../fascinating-science/049-volcanoes/packs/ian-chatterbox-v1` | 23 | 414 | NOT STARTED |
| Atom | `.../fascinating-science/001-what-is-an-atom/packs/ian-chatterbox-v1` | 23 | 292 | NOT STARTED |
| Genesis | `.../religion/bible/01-genesis/pack` | 7 | 1533 | NOT STARTED |
| Zheng Yi Sao | `.../pirate-biographies/01-zheng-yi-sao/pack` | 21 | 303 | NOT STARTED |
| Monte Albán | `.../fascinating-curiosities/01-mystery-of-monte-alban/pack` | 5 | 1006 | NOT STARTED |
| Unconquered People | `.../fascinating-curiosities/02-the-unconquered-people/pack` | 5 | 986 | NOT STARTED (not in catalog?) |

Voice ID for all: `ian-narration` (check catalog for exceptions — soccer may use `ian-chill-clear`)
Realignment script: `~/bin/realign-catalog.py`

### Priority order:
1. Finish soccer books (in progress)
2. Volcanoes + Atom (23 langs each, published, high user impact)
3. Zheng Yi Sao (21 langs)
4. Genesis (7 langs, 1533 segs — big but fewer langs)
5. Monte Albán + Unconquered People (5 langs each)

## NON-NEGOTIABLE RULES

1. **NEVER use --force on publish.** If it fails, fix the problem.
2. **NEVER force-accept bad segments.** Diagnose, fix tts.text, or ask the user.
3. **User is final arbiter.** Always present WAV paths for quality decisions.
4. **No regexes for text fixes.** Use an LLM.
5. **Understand failures before restarting.** Every failure is a learning opportunity.
6. **Statistical rigor.** Record human verdicts, calibrate thresholds from data.

## Plans Written for Future Agents

- `~/projects/ttsctl/PLAN_pronunciation_test.md` — pre-generation pronunciation testing
- `~/bin/realign-catalog.py` — catalog-wide realignment script
- `~/encorpora/books/literature/tolstoy-short-stories/scripts/validate_segments.py` — pre-generation segment validation
