# Tutomaton — Language Module Authoring Guide

This guide is the playbook for adding a new language tutor module. Following it produces a Spanish-quality language module in ~15-25 hours of focused work, depending on how exotic the target language is.

## What you're building

A self-contained language module that drops into Tutomaton at `languages/<code>/`. It ships:

- A SQLite corpus (`data/<code>.sqlite3`) with words, lessons, themes, and optionally L1-aware error patterns
- A retriever (`retrieval/retriever.ts`) that maps user queries → relevant corpus snippets
- A system prompt + grounding instruction (`prompts/`)
- A module manifest (`module.json`)
- A build pipeline (`build_corpus.py`) that's reproducible from a clean checkout

The pack shell, LanguageManager, and chat UI are language-agnostic — they consume your module.

## Quality bar

Every module ships at "Spanish-parity" minimum:

- **~35 lessons** of ~400-600 words each (~14-21K words of authored content)
- **25 themes × ~30 items** = ~750 vocabulary items with IPA + L1 translations
- **5K-10K word lemmas** (from kaikki Wiktionary, filtered by frequency)
- Optional but high-ROI: **L1-error patterns** for ~3 L1 cohorts × ~50 errors each
- Optional language-specific tables (phrasal verbs for English, classifiers for Mandarin, kanji for Japanese, etc.)

Seed-level (10 lessons, 10 themes) is **not acceptable** for shipping. The current Mandarin module is at seed level and counts as tech debt to be paid off.

## The Five Phases

### Phase 1: Scaffold (~5 minutes)

```bash
cd packs/tutomaton
python3 scripts/bootstrap-language.py <code> <Name> <Native Name> <voice-code>
# Example: python3 scripts/bootstrap-language.py fr French Français fr-FR
```

This creates `languages/<code>/` with stubs for every file you need.

### Phase 2: Get the inputs (~30 minutes)

Download the kaikki Wiktionary dump for your target language:

```bash
mkdir -p ~/data/kaikki
curl -fL https://kaikki.org/dictionary/<Name>/kaikki.org-dictionary-<Name>.jsonl \
  -o ~/data/kaikki/kaikki-<code>.jsonl
```

For languages with specialized data sources, fetch those too. Some commonly useful:

- **English**: CMU Pronouncing Dictionary (`cmudict`), SUBTLEX-US frequency list
- **Mandarin**: HSK level lists, CC-CEDICT
- **Japanese**: JLPT level lists, JMdict
- **Arabic**: root-pattern tables

Cache them under `~/data/<lang>_rag/`. The build script paths are configured in `build_corpus.py`.

### Phase 3: Author the lessons (~8-12 hours)

Open `languages/<code>/lesson_data.py`. You'll see 30 universal lesson stubs and an empty section for language-specific ones.

**Author every TODO** at reference-grade depth (~400-600 words, with examples in target language, common-mistake callouts, and where relevant `l1_notes` for the L1 cohorts you'll target later).

**Add language-specific lessons** for what's unique:

| Language family | Language-specific must-have lessons |
|---|---|
| Romance | ser_vs_estar (or equivalent), preterite_vs_imperfect, subjunctive_triggers |
| Germanic | strong_weak_verbs, modal_particles (DE), separable_verbs (DE) |
| CJK | tones (ZH), classifiers (ZH/JA), kanji_readings (JA), 把/被 (ZH), particles (JA) |
| Slavic | aspect_perfective_imperfective, case_system, motion_verbs (RU) |
| Semitic | three_letter_roots, broken_plurals, mood_jussive (AR) |
| Agglutinative | vowel_harmony (TR/FI), case_suffixes (FI/HU/KO), polite_speech_levels (KO/JA) |

Tone-of-voice guidance for lesson body:

- Lead with the rule, then 2-3 short examples, then a "common mistakes" callout
- Tables work in the chat UI for ≤4 columns; wider tables wrap awkwardly
- Don't write h1 headers in the body (the title is rendered separately)
- End lessons with `**Related**: [[topic_slug]]` if you have cross-links not already in the `related` field

### Phase 4: Author themes + word lemmas (~3-5 hours)

`theme_data.py` — fill in all 25 themes with ~30 items each. For each item, supply:

- `word` (in target language with proper script/diacritics)
- `ipa` (recommended; pull from kaikki at build time if you skip)
- `l1` dict for at least `{en: "..."}` and the top 4-5 L1 cohorts you care about

Themes deliver canonical vocabulary lists to the user — these get returned DIRECTLY (no LLM call), so they need to be authoritative.

The `build_corpus.py` already pulls the top 8000 word lemmas from kaikki automatically. If your kaikki entries are noisy for top-frequency words, hand-curate overrides in `_source/core_vocab.json`.

### Phase 5: L1-aware errors (~3-5 hours per L1, optional)

This is the killer differentiator. Open `l1_errors_data.py` and author ~50 errors per L1 cohort you're targeting. Each error needs:

- `error_pattern`: a regex that matches the typical mistake (be conservative — false positives are worse than misses)
- `correct_form`: what they should have said
- `l1_explanation`: explained in the L1 (in L1 script)
- `en_explanation`: same in English (fallback)
- `example_wrong` / `example_right`
- `severity`: high / med / low

**Pick L1s by ROI**: for target=English, the highest-value L1s are Spanish, Chinese, Japanese, Korean, French, Portuguese, German, Russian, Arabic, Hindi. Pick 3 to start.

For non-English targets, L1-errors are still useful but ROI is lower (smaller learner cohort per L1→L2 pair). Defer to v0.2 unless there's an obvious must-have (e.g. ES→PT, FR→ES, DE→NL).

### Phase 6: Build + smoke test + publish

```bash
cd languages/<code>
python3 build_corpus.py
# → data/<code>.sqlite3 built; row counts printed
```

Add a smoke-test (recommended): write a tiny `test_retriever.py` that loads the sqlite, calls a handful of canonical queries through your `retriever.ts`'s SQL paths (port to Python is easy), and confirms the right kind/lesson comes back.

```bash
cd packs/tutomaton
python3 ../../tools/llm-packs/publish.py language packs/tutomaton <code> \
  --sync-manifest --upload
```

The publisher uploads the language module ZIP to S3, updates Tutomaton's `manifest.json` `languages[]` array with the new entry's URL + sha256, and prints the published URL.

Then to flip Tutomaton to a version that includes this new language:

```bash
python3 ../../tools/llm-packs/publish.py pack packs/tutomaton --upload --update-catalog
```

(Polish machine uploads the patched catalog per the `CORPAN_LLM_HANDOFF.md` instructions.)

## Repeatable cost per language

| Activity | Hours |
|---|---|
| Phase 1: scaffold | 0.1 |
| Phase 2: data fetching | 0.5 |
| Phase 3: lessons (35 × ~12 min each) | 7 |
| Phase 4: themes + words | 4 |
| Phase 5: L1-errors (per L1, optional) | 4 |
| Phase 6: build + smoke + publish | 1 |
| Language-specific code/schema | 2-4 |
| **Total per language** | **~15-25 hrs** |

For 50 languages at this rate: ~750-1250 hours. That's months of focused work, but it's bounded, parallelizable across multiple contributors (the kit makes it so anyone can author a language without understanding the runtime), and each shipped language compounds the pack's value.

## Tips for high-quality output

- **Don't paraphrase Wikipedia.** Lessons should be original, learner-focused, and example-driven. Wikipedia explains for reference; you're explaining for learning.
- **Pick examples that survive translation.** "I am 25 years old" works in 30 languages; "I'd really go in for a cup of tea" doesn't.
- **Calibrate to CEFR**:
  - A1: present tense + 500 most-common words
  - A2: past + future + 1000 words
  - B1: perfect aspects + conditionals + 2500 words
  - B2: subjunctive + advanced syntax + 5000 words
- **L1-error severity matters**: `high` triggers a gentle correction tone; `low` is a "by the way" note. Don't over-flag — that's nagging.
- **Themes are canonical lists** — the LLM gets bypassed, so every word in your theme list is what the user sees. Curate ruthlessly.

## Reference modules

- `packs/tutomaton/languages/es/` — the gold standard. ~35 lessons, ~25 themes × 30 items, 522K verb rows, 157 MB sqlite.
- `packs/tutomaton/languages/_template/` — the empty scaffold (do not edit; this is what `bootstrap-language.py` copies from).
- `packs/tutomaton/languages/en/` — once authored, the most current example of the universal kit + L1-errors.
- `packs/tutomaton/languages/zh/` — once expanded, the example of universal-kit + heavy language-specific tables (classifiers, aspect_markers, chengyu).
