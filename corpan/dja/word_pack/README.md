# Word-explanation pack data pipeline

Builds the SQLite database for the **word-explanation pack** ("Phrase Flip"
word explanations). It generalizes the Hanzi pack (`dja/hanzi_pack`) from
per-character etymologies to per-word explanations.

## What a word explanation is

For each unique English word in the corpus, ONE flowing paragraph of about 50
words that captures:

1. the word's **range of common senses** (its polysemy) and how they relate,
2. where the word **came from** (origin/etymology), and
3. how that original idea **branched** into the modern senses.

Exemplar (the quality bar):

> Running means moving rapidly on foot, but can also describe something
> operating, continuing, or flowing, such as a running engine, program, or
> stream. It comes from Old English rinnan and irnan, to flow or move swiftly,
> from Proto-Germanic \*rinnaną. The original idea of continuous movement later
> branched into these modern uses.

The paragraph is authored in English, then written **in each target language**
(so a Chinese speaker reads the explanation in Chinese), across the corpus's 54
languages (English + 53 targets).

## Word universe

The set of words to explain = unique English words from BOTH:

- the core corpus (`release.sqlite3`, the English side of `cor_translation`), and
- every phrase pack under `corpan/tools/phrase-packs/phrase-*/phrases.json`.

```bash
python3 extract_words.py                 # prints the unique word list
python3 extract_words.py --out words.txt # or write to a file
```

As of this writing that is **11,757 unique surface words** across ~25,269
English phrases (10,000 core + 15,269 in 33 phrase packs).

## Schema

One generic table (mirrors `hanzi_etymology`):

```sql
CREATE TABLE word_explanation(
  word TEXT NOT NULL,
  language_code TEXT NOT NULL,
  paragraph TEXT NOT NULL,
  PRIMARY KEY(word, language_code)
);
```

`pack_meta` carries `schema_version` (currently `1` for this pack family),
`generated_at`, `core_db`, and `word_count`.

## Generate explanations (LLM)

`generate_word_explanations.py` runs three stages:

1. **English authoring** — one ~50-word multi-sense paragraph per word.
2. **Origin verification** — an adversarial critic pass over ONLY the
   etymology clause (definitions/senses are low-risk; origins are
   hallucination-prone). Each word gets an `origin_confidence` of
   `high` / `medium` / `low`; overstated or wrong roots are softened or
   rewritten. **Never confabulate a root** — hedge when unsure.
3. **Translation** — faithfully render the verified English into each target
   language; no added facts.

```bash
# small sample, 4 representative targets
python3 generate_word_explanations.py \
  --words running set light the of robot egg deadline freedom \
  --langs en zh-Hans ar hi es

# full universe, all corpus languages
python3 generate_word_explanations.py --all-langs
```

Output writes to `seed/explanations_full.json`. Pass that file into the builder
with `--explanations`.

### Backends: `--provider openai` (billed) vs `--provider codex` (free)

The default `--provider openai` routes batches through `corpora_ai` (billed
OpenAI API). For the full-corpus run, use the **subscription codex-cli**
backend (`--provider codex`, FREE, gpt-5.5): it composes each stage's
system+user prompt into one JSON-only `codex exec` call (via
`cor/utils/codex.py`), validates the reply against the same
`ExplanationBatch`/`VerifyBatch`/`TranslationBatch` schemas, retries a failed
batch up to `--max-retries` (default 2) times, then **skip-and-logs** so one
bad batch can't wedge the run. Batches run concurrently (`--concurrency`,
default 8) and the seed checkpoint is written under a lock after each batch, so
a kill mid-run is safe to resume (it re-targets only unfinished words/langs).

```bash
# free codex backend, concurrent, resumable
python3 generate_word_explanations.py \
  --provider codex --concurrency 12 --batch-size 12 \
  --all-langs --out seed/explanations_full.json
```

Measured (gpt-5.5, ~50-word paragraphs): a batch of 12 words ≈ 20s; per-word
cost drops with batch size (≈2.9s/word at 4 → ≈1.7s/word at 12). The ChatGPT
subscription showed **no throttling at concurrency 8 or 16** on the probe.
Recommended: `--batch-size 12 --concurrency 12`. Projected wall-time at that
setting: EN authoring + verify of all 11,757 words ≈ **~1 h**; full ×53-language
translation ≈ **~1 day** (≈18 h at concurrency 16).

## Build

```bash
python3 build_word_pack.py \
  --explanations seed/explanations_seed.json \
  --out ../../packs/wordpan/data/word.sqlite3
```

Options: `--core-db`, `--packs-dir`, `--limit N`, `--include-seed-words`.

## Seed format

`seed/explanations_seed.json` is a list of records:

```json
{
  "word": "running",
  "explanation": {
    "en": "Running means moving rapidly on foot, but ...",
    "zh-Hans": "Running 指快速用脚奔跑 ...",
    "ar": "...",
    "hi": "...",
    "es": "..."
  },
  "origin_confidence": "high",
  "origin_note": "optional: present only when the origin needed hedging"
}
```

The checked-in seed is the operator-approved **canonical sample** (17 words),
not the full set. Replace/extend it with the full generated output once the
quality bar is approved.

## Consumer lookup (native-first + English fallback)

The pack app should look up `word_explanation` by `(word, ui_language_code)`
first, then fall back to `language_code = 'en'` when the UI language is absent —
the same native-first-with-English-fallback pattern used by Hanzipan.
