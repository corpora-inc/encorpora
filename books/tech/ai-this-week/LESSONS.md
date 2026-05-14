# AI This Week — Lessons Learned (Issue 1 retrospective)

Read this BEFORE producing issue 2. This file exists to keep the next
cold-start agent (you, in a fresh context next week) from re-stepping on
the same rakes I stepped on producing issue 1. Pair this with
`CONVENTIONS.md` (the format spec).

## Rakes I stepped on (chronological)

### 1. Style direction baked into `tts.text` instead of a proper layer

**Mistake:** I put `Style: Calm, friendly host... Read this: <line>` into
each segment's `tts.text`. Gemini consumed it as direction, but the
audio's spoken content matched only the `<line>` portion, while the
display text was the bare line. This created display-vs-audio drift and
ugly fallback paths inside the Gemini backend.

**Right way:** Use the per-speaker `director_prompt` in
`narration.yaml`'s `speakers.<id>.director_prompt`. The pipeline
prepends it AT GENERATE TIME, never touching the stored `text` or
`tts.text`. See `pipeline.py:782-805` for the resolution order
(segment override → speaker → pack → empty).

**Stop sign:** if you find yourself writing `"Style: ..."` into a
segment text field, you are doing it wrong.

### 2. Display `text` ≠ spelled-out `tts.text`

**Mistake:** I wrote `text` and `tts.text` identical, with both
spelled-out forms ("May thirteenth, twenty twenty six"). This broke
alignment-to-display: Whisper free-transcribes `"May 13, 2026"` but the
display says `"May thirteenth, twenty twenty six"` — false defects
everywhere AND the reader highlights the wrong words.

**Right way (memory: `feedback_tts_text_divergence.md`):**
- `text` = **natural display form**: numerals where natural, in the
  conventions of the target language. `"May 13, 2026"`, `"GPT-5.5"`,
  `"$2 billion"`, `"30%"`, `"Opus 4.7"`, `"DeepSeek V4 Pro"`, `"Kimi K 2.6"`.
- `tts.text` = **spelled out for the voice model**: `"May thirteenth,
  twenty twenty six"`, `"GPT five point five"`, `"two billion dollars"`,
  `"thirty percent"`, `"Opus four point seven"`.
- Forced alignment uses `text` (`pipeline.py:1056` → `align_text =
  seg.get("text", "")`). Reader highlights map to display.
- For other languages, do whatever is most natural in that language:
  e.g., German `13. Mai 2026` for display, spelled-out for tts.text.

### 3. Gemini truncates segments silently

**Pattern observed:** Gemini Flash 3.1 TTS sometimes produces audio
that drops the last clause(s) of the input text, especially on short
segments and on segments ending with low-energy words ("Vindy", "run",
"end to end"). The pipeline's forced-alignment validator misses these
because Whisper-forced-alignment will **ghost** the missing words onto
trailing silence or breath to satisfy its target-words constraint.

**Detection (already shipped in this session):** the new
`validate_tail_truncation_free_transcribe` validator
(`validator.py:670+`) does a free Whisper pass on the audio tail and
compares last-N words to last-N expected. Gated on `vad_whisper_gap_ms
> 600` to keep cost low.

**Stronger detection (FUTURE work — issue 2):** the user wants a
**systemic LLM-based** check that compares full free-transcript to full
display text per segment. Not yet built. Use `claude-haiku-4-5` or
similar to assess semantic equivalence (accounting for numeral/spell-
out differences).

**Manual safety net:** before publishing, run the audit script at
`/tmp/audit-en.json` (the inline one in the issue 1 transcript). It
flags segments where heard text length < 70% of expected.

### 4. First-word fade-in slips past validator on Gemini

**Pattern:** Gemini sometimes begins a segment with a very soft onset
("Exactly" with the first 50ms barely above silence). The validator's
`first_word_weak` check exists (`validator.py:839`) but ships
**non-blocking** on Gemini by default via
`_GEMINI_VOICE_NON_BLOCKING_CHECKS` (line 175).

**Fix shipped in narration.yaml for this pack:**
```yaml
validation:
  first_word_weak_threshold: 0.30           # tighter than 0.20 default
  no_gemini_downgrade_checks:
    - first_word_weak                       # keep BLOCKING for dialog
```
That config promotes the check to blocking + tightens the threshold.

### 5. Trim ratio gate too loose for dialog

**Pattern:** trim phase only runs when validator flagged
`trailing_silence`, which uses a ratio gate (>25% of segment duration).
For long dialog turns, 1.2s of trailing silence is only 6% — passes
the gate, silence stays baked in.

**Fix shipped:**
```yaml
trimming:
  always_trim: true       # bypass validator gate
  tail_grace_ms: 50
  tail_fade_ms: 100
```
Result: every segment trimmed to ~150ms trailing silence regardless of
ratio. The reader inserts inter-segment pauses from `pause_after_ms`
metadata at playback (NOT baked into audio).

### 6. Initial banner direction was depression in oil paint

**Pattern:** I asked for "painterly editorial illustration, restrained
palette, no other people prominent" — got six different versions of
"hostage line-up in sepia." Stiff body language, dead faces, frontal
mug-shots, dirty-amber palette across all.

**Right direction (final):** Modern editorial PHOTOGRAPHY, NOT
painterly. Cinematic shallow depth-of-field with the narrator
back-turned in foreground (no face), the bustling elite scene in
sharp focus past them. Use action verbs ("head thrown back laughing",
"mid-toast clinking glasses", "leaning across grinning"). Drop
"restrained palette" — let jewel tones, ember, brass, indigo through.

**Banner anatomy:**
- Vindy = OUTDOOR Paris at night, packed cafe/boulevard, observer
  back-turned in soft foreground
- Ron = INDOOR fancy place with floor-to-ceiling window onto Atlanta
  skyline, packed room, observer back-turned
- Both: surrounding people visibly attractive + successful + having
  a good time. It's a place people WANT to be.

### 7. Catalog published without `CHARACTERS_META` + `VOICE_PROFILES`

**Mistake:** I ran `ttsctl publish` while `patch-catalog.py` still had
no entries for `vindy` / `ron` characters or `gemini-vindy` /
`gemini-ron` voice profiles. Result: the reader showed "Gemini" as
the narrator name instead of "Vindy" or "Ron". Catastrophic for UX.

**Right order (always):**
1. Generate AND audit audio
2. Re-align to final display text
3. Add character + voice profile entries to `patch-catalog.py`
4. Upload winning avatar/banner JPGs to canonical S3 keys
5. Update `asset-urls.json`
6. **Dry-run** `patch-catalog.py --dry-run` and review the diff
7. Run `patch-catalog.py` for real
8. THEN `ttsctl publish`
9. Re-run `patch-catalog.py` again post-publish (memory:
   `feedback_publish_then_patch`)

### 8. Fact-checking happens BEFORE TTS spend, not after

**Mistake:** I drafted manuscript from research-agent output and
generated audio before fact-checking. Issue 1 shipped with one
confidently-wrong claim ("Opus 4.6 was the first model past Elo 1500"
— Opus 4.7 had already beaten that a month prior).

**Right order (mandatory):**
1. Research (3 parallel WebSearch agents — see
   `scripts/research_prompts.md`)
2. Draft manuscript per `CONVENTIONS.md`
3. **Fact-check pass** before TTS — verify every substantive claim.
   This is a gating step. Spend not authorized on a draft with
   unresolved corrections.
4. Apply corrections
5. THEN generate audio

### 9. Don't use commercial-break framing

**Mistake:** initial manuscript had "Up next, the leaderboards" /
"After this, the bigger picture" / "Stay with us" — all imply a
break / ad. There is no break in this show; nothing to stay through.

**Right way:** flow continuously. "Okay, let's get to the leaderboards" /
"Now let's pull back to the bigger picture" / "Good place to land."
See `CONVENTIONS.md` "Episode format" section.

### 10. Speaker assignments need an audit

**Mistake:** I had one line ("So the model is huge on paper but cheap
to run.") accidentally voiced by Ron when it should be Vindy.

**Right way:** Before generate, scan every `**HOST:**` and
`**ANALYST:**` label. Host asks / framings / quick reactions. Analyst
explains / delivers facts. Each segment's `speaker_id` in segments.json
must match.

**For issue 2:** consider building a small speaker-audit subagent that
flags mismatches automatically.

### 11. Don't show narrator face in banner; do show their presence

**Resolved direction:** narrator back-turned in soft foreground,
shoulders + back of head only, bustling scene in sharp focus past
them. They are the contemplative observer above the fray.

### 12. Avatars and banners are not the same composition

**Avatar:** square 1024×1024, head-and-shoulders portrait, face
visible, editorial photography style.
**Banner:** landscape 1536×1024, narrator back-turned (face NEVER
shown), bustling scene as the subject. Avatar face never has to
match banner face because banner face does not exist.

### 13. CloudFront caches images for 1 year (immutable header)

**Got bitten:** uploaded new banners to same S3 keys, asked user to
look at CDN URLs — CloudFront kept serving the old cached versions
for an hour. User got frustrated.

**Right way:**
- During iteration, save to LOCAL paths (`/tmp/banners/...jpg`) — not
  CDN. Show user local paths.
- Only upload to CDN once you have a winner.
- If CDN cache is wrong, use CloudFront invalidation API to clear.

### 14. M4As are gitignored — never `git checkout` them

Per memory `narration_pipeline`: M4As live on disk + S3 only. Don't
restore them from git or you'll lose recent regens.

---

## What's already working (don't rebuild)

| Capability | Where | Status |
|---|---|---|
| Per-segment speaker routing | `pipeline._compute_seg_tts_args` | shipped 2026-05-13 |
| Per-speaker director_prompt | `narration.yaml speakers.<id>.director_prompt` | shipped 2026-05-13 |
| Aggressive trim for dialog | `trimming.always_trim: true` | shipped 2026-05-13 |
| Tail-truncation free-transcribe | `validator.validate_tail_truncation_free_transcribe` | shipped 2026-05-14 |
| First-word-weak per-pack override | `validation.no_gemini_downgrade_checks` | shipped 2026-05-14 |
| Multi-variant avatar generation | `infra/generate-narrator-variants.py` | shipped 2026-05-14 |
| Pacing pass (rule-based) | `scripts/apply_pacing.py` | shipped 2026-05-13 |
| Concat with reader-style pauses | `/tmp/concat_with_pauses.py` | shipped 2026-05-13 |

## What still needs building (FUTURE work)

1. **Systemic LLM-based audio-vs-display validator.** Replace the
   simple ratio-based audit with an LLM judge that knows numeral ↔
   spelled-out equivalence is OK but missing clauses are not. User
   asked for this explicitly issue 1. Likely promote to a new check
   in `validator.py` running per-segment when alignment passes.

2. **Speaker-assignment audit subagent.** Read the manuscript, flag
   any `**HOST:**` line that reads like analyst material or vice
   versa. Issue 1 had one such mistake.

3. **Per-language phonetics maps for tts.text.** EN-only so far.
   For Hindi/Arabic/Chinese, model names like "GPT-5.5" or "Kimi
   K 2.6" need per-language phonetic respelling in tts.text.
   Reference pattern: `~/encorpora/books/vehicles/motorcycles/
   01-the-story-of-the-motorcycle/scripts/generate_segments.py`
   (`EN_PHONETICS`, `apply_phonetics`).

4. **Reader UI for multi-voice dialog packs.** Current reader shows
   one narrator label per pack. Dialog packs need to show the cast
   with avatars per speaker and ideally a per-segment speaker badge
   in the highlight bar.

5. **Auto-generation of segments.json from manuscript with
   numeral/spell-out divergence.** Right now the
   `generate_dialog_segments.py` puts the same text in both `text`
   and `tts.text`. We need it to (a) keep display numerals in `text`
   and (b) spell them out in `tts.text` via a phonetics-map pass.

## Issue-2 readiness checklist

Run these in order before touching keyboard:

- [ ] Read this file
- [ ] Read `CONVENTIONS.md`
- [ ] Read `scripts/research_prompts.md`
- [ ] Read `~/projects/ttsctl/CLAUDE.md`
- [ ] Check `~/encorpora/books/tech/ai-this-week/001-may-13/fact_check.json`
  as a sample fact-check output structure

Then:

1. Pick an issue date (e.g., next Wednesday)
2. Dispatch 3 research agents in parallel using
   `scripts/research_prompts.md` templates
3. Draft manuscript respecting display-text-vs-tts.text divergence
   FROM THE START (do not bake spelled-out forms into display)
4. Run fact-check pass; apply corrections
5. Run speaker-assignment audit (hand or future subagent)
6. `ttsctl generate` (dialog packs now batch via cohort 1 fix)
7. Audit free-transcribe vs display (catches truncations)
8. `apply_pacing.py`
9. Verify catalog entries exist for any new characters
10. `ttsctl publish --version <next>`
11. `patch-catalog.py`
12. Verify on CDN

If you hit a rake not on the list above, add it.
