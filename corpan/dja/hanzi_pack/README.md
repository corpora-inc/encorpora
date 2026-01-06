# Hanzi pack data pipeline

This folder builds the SQLite database shipped with the Mandarin character pack.

## What it does

- Scans the core `release.sqlite3` for unique Hanzi characters.
- Merges in stroke/etymology seed data.
- Emits a standalone `hanzi.sqlite3` used by the pack.

## Build

```bash
python3 encorpora/corpan/dja/hanzi_pack/build_hanzi_pack.py
```

Options:

- `--core-db /path/to/release.sqlite3`
- `--out /path/to/hanzi.sqlite3`
- `--strokes /path/to/strokes_seed.json`
- `--etymology /path/to/etymology_seed.json`
- `--limit 200` (for quick iteration)

## Stroke data import

The pack expects stroke JSON in the Make Me a Hanzi / Hanzi Writer format
(either a `graphics.txt`/`graphics.jsonl` file or a directory of per-character JSON).

```bash
python3 encorpora/corpan/dja/hanzi_pack/import_hanzi_strokes.py \
  --source /path/to/hanzi-strokes \
  --out encorpora/corpan/dja/hanzi_pack/seed/strokes_full.json
```

### Make Me a Hanzi dataset (recommended)

If you have already downloaded Make Me a Hanzi locally, point the importer at its
`graphics.txt` file. We keep a copy under:

```
encorpora/corpan/dja/hanzi_pack/vendor/makemeahanzi/graphics.txt
```

The license lives alongside it in `encorpora/corpan/dja/hanzi_pack/vendor/makemeahanzi/COPYING`.

Then build:

```bash
python3 encorpora/corpan/dja/hanzi_pack/build_hanzi_pack.py \
  --strokes encorpora/corpan/dja/hanzi_pack/seed/strokes_full.json \
  --etymology encorpora/corpan/dja/hanzi_pack/seed/etymology_full.json
```

## Data format

`seed/strokes_seed.json` is a list of records (Make Me a Hanzi / Hanzi Writer format):

```json
{
  "char": "一",
  "strokes": ["M150 500 L850 500"],
  "medians": [[[150, 500], [850, 500]]],
  "radical": "一",
  "frequency": 1,
  "tags": ["seed"]
}
```

The pack DB stores stroke data in a single `hanzi_writer` table with JSON payloads:

```json
{
  "character": "一",
  "strokes": ["M150 500 L850 500"],
  "medians": [[[150, 500], [850, 500]]]
}
```

`seed/etymology_seed.json` is a list of records:

```json
{
  "char": "一",
  "etymology": {
    "en": "One. A single horizontal line representing unity."
  }
}
```

## Etymology generation (LLM)

Use the generator to create 2-5 sentence etymologies in English, then translate to more languages:

```bash
python3 encorpora/corpan/dja/hanzi_pack/generate_hanzi_etymologies.py \
  --limit 200 \
  --langs en es fr de
```

For all supported languages in the core DB:

```bash
python3 encorpora/corpan/dja/hanzi_pack/generate_hanzi_etymologies.py \
  --limit 200 \
  --all-langs
```

The output writes to `seed/etymology_full.json` by default. Pass that file into
`build_hanzi_pack.py --etymology`.

## Notes

- The seed data is a minimal demo set. Replace it with your full stroke/etymology sources.
- The pack DB stays independent from the core corpus; it only uses the core DB to discover characters.
