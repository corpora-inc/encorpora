# wordpan-es-en — Spanish explanations for English words

A **data-only** content pack. It ships a SQLite database of per-word
explanation paragraphs (`word_explanation(word, language_code, paragraph)`),
authored in English and translated to Spanish, for the ~11,757 unique English
words in the Corpán corpus + phrase packs.

There is **no launchable experience** here. The built-in **Phrase Flip**
experience (`corpan-app/src/components/MainExperience.tsx`) queries this pack on
long-press (right-click / long mouse-press on desktop) to show a word-meaning
popover in the user's native language, with English fallback — mirroring how
Hanzipan queries `hanzi_etymology`.

## Schema

```sql
CREATE TABLE word_explanation(
  word TEXT NOT NULL,
  language_code TEXT NOT NULL,
  paragraph TEXT NOT NULL,
  PRIMARY KEY(word, language_code)
);
CREATE INDEX word_explanation_language ON word_explanation(language_code);
```

`pack_meta` carries `schema_version` (`1`), `generated_at`, `core_db`,
`word_count`.

## Building the DB

Generator lives at `corpan/dja/word_pack/build_word_pack.py`. The verified
seed (EN + ES paragraphs) is produced by the word-explanation generation run.

```bash
python3 corpan/dja/word_pack/build_word_pack.py \
  --explanations /home/skyl/wordpack_seed/english_verified.json \
  --include-seed-words \
  --out corpan/packs/wordpan/data/word.sqlite3

# This pack ships en + es only (for now). Strip any other languages the
# seed may already carry from the live generation run:
sqlite3 corpan/packs/wordpan/data/word.sqlite3 \
  "DELETE FROM word_explanation WHERE language_code NOT IN ('en','es'); VACUUM;"
```

Result: 23,514 rows (11,757 en + 11,757 es), ~9.2 MB raw / ~3.1 MB gzipped.

## Packaging

```bash
node corpan/packs/wordpan/scripts/pack.mjs   # → wordpan-es-en.zip
```

## Hosting / catalog

Registered as a `channel: "preview"` entry in the corpan-app catalog
(`corpan-app/src/contentPacks/catalog.ts`). In dev it is served from the vite
`/packs` middleware (`/packs/wordpan-es-en.zip`); in production the ZIP is
uploaded next to `hanzipan.zip` under `corpan/packs/` on the CDN.

## Lookup contract (consumer side)

```sql
SELECT language_code, paragraph FROM word_explanation
WHERE word = ?            -- lowercased surface word
```

The host picks `paragraph` by preferred language order
`[...nativeLanguages, "en"]` (native-first, English fallback), identical to the
Hanzipan etymology lookup.

## Architecture note: EN base vs bundled (follow-up)

This pack bundles **en + es** together (~9.2 MB). Bundling the full English
side into every (native → en) pair pack is redundant across the ~2,500 possible
native languages. The clean optimization is a **shared `wordpan-en-base` pack**
(the English paragraphs, installed once) plus per-native packs that carry only
that language's paragraphs and depend on the base. The current pack system has
no shared-base dependency primitive, so we bundle en+es for the first ship and
track the base-pack split as a follow-up. See PR body for detail.
