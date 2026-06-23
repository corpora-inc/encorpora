# What Men Live By — State for Next Agent

## IMMEDIATE: Publish RU, EN, ES

All 3 languages are mastered and audited (or ES is finishing mastering now). 
Segments are fixed. Ready to publish WITHOUT --force:

```bash
PACK=/home/skyl/encorpora/books/literature/tolstoy-short-stories/what-men-live-by/packs/ian-chatterbox-v1

ttsctl publish $PACK --lang ru --voice-id ian-narration --version 0.2.0 --tier premium --price 0.99 --product-id corpan.book.tolstoy_what_men_live_by
ttsctl publish $PACK --lang en --voice-id ian-narration --version 0.2.0 --tier premium --price 0.99 --product-id corpan.book.tolstoy_what_men_live_by
ttsctl publish $PACK --lang es --voice-id ian-narration --version 0.2.0 --tier premium --price 0.99 --product-id corpan.book.tolstoy_what_men_live_by
```

Use version 0.2.0 to signal a clean break from the messy 0.1.x series.

## CRITICAL RULES (from user)

1. **NEVER use --force on publish.** If publish fails validation, FIX THE PROBLEM.
2. **NEVER force-accept bad segments.** Diagnose, fix tts.text, or ask the user.
3. **Nothing is better than bullshit.** Do not ship anything that isn't perfect.
4. **User is the final judge.** Present WAV paths for every quality decision.
5. **No regexes for text fixes.** Use an LLM to fix text content.

## Remaining Work

### 20 more languages need TTS generation
Translations exist for all 22 languages. Only RU, EN, ES have audio.

### Catalog-wide realignment with Whisper large-v3
- Script at ~/bin/realign-catalog.py
- Config already changed: whisper_model = "large-v3"
- 185 packs, ~101K segments, ~8 hours with parallelization
- Do Three Questions (smallest pack) first as validation

### Pipeline improvements needed
- Content validation before publish (wrong-language detection, tts.text truncation check)
- Pronunciation test command (~/projects/ttsctl/PLAN_pronunciation_test.md)
- Pre-generation segment validation (scripts/validate_segments.py exists, needs ttsctl integration)

## What was fixed this session
- validator.py: truncated_last_word + post_speech_pop checks
- config.py: whisper_model medium → large-v3
- pipeline.py: trim safety guard (>30% zero-duration → skip trim)
- Changelog entries in ~/projects/ttsctl/changelog/decisions/
