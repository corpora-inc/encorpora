# Rasmapan data builder

Lives at `corpan/packs/rasmapan/build/`. Generates the pack-owned
SQLite at `corpan/packs/rasmapan/data/arabic.sqlite3` from Amiri
glyph outlines + hand-curated seed JSON.

Unlike `dja/hanzi_pack/` (which scans corpan's shared
`release.sqlite3` for its character set), Rasmapan's letter list
and word list are entirely curated inside the pack — so the builder
lives **with** the pack rather than under `dja/`. Everything for
this pack lives under one folder.

## What it does

1. Loads `vendor/Amiri-Regular.ttf` (SIL OFL 1.1).
2. For each letter family in `seed/letters_seed.json` and each of the
   letter's positional forms (isolated, initial, medial, final),
   extracts the glyph's outline via `fontTools` and normalizes it to
   a 1000×1000 viewBox.
3. Joins extracted outlines with hand-authored stroke-order
   metadata from `seed/stroke_orders_seed.json` to produce
   per-glyph `data_json` records (`{ outline, strokes, medians,
   scoring }`). Outlines fall back to contour-based medians when
   the seed leaves a glyph blank.
4. Inserts records for ligatures (`seed/ligatures_seed.json` —
   lam-alif), curated words (`seed/words_seed.json`), onboarding
   lessons (`seed/lessons_seed.json`), and calligraphic-style
   notes (`seed/styles_seed.json`).
5. Writes everything to a fresh `arabic.sqlite3` next to the pack's
   `manifest.json`.

## Requirements

- Python 3.10+
- `fontTools` (any recent version). Install via:
  - `brew install fonttools` (macOS — provides the CLI shims and the
    lib at `/opt/homebrew/opt/fonttools/libexec/...`; the builder
    auto-detects this path), **or**
  - `pip install fonttools` into your active env, **or**
  - `pip install -r requirements.txt`

## Build

```bash
python3 corpan/packs/rasmapan/build/build_arabic_pack.py
```

Writes to `corpan/packs/rasmapan/data/arabic.sqlite3` by default.
Pass `--out PATH` to override.

## Source files

| File                                | Purpose                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `vendor/Amiri-Regular.ttf`          | Naskh font (SIL OFL 1.1) — glyph outlines.                                                                  |
| `seed/letters_seed.json`            | 28 Arabic letter families and their positional-form codepoints. Hand-curated.                               |
| `seed/stroke_orders_seed.json`      | Stroke-order overrides per letter family (optional; auto-derived per contour when empty).                   |
| `seed/ligatures_seed.json`          | Lam-alif (and other future ligatures): codepoints + stroke order.                                           |
| `seed/words_seed.json`              | 40 curated 2–4-letter common Arabic words for word-tracing mode.                                            |
| `seed/lessons_seed.json`            | Six-step intro-lesson content (RTL, abjad, four forms, harakat, sound-to-letter, trace alif).               |
| `seed/styles_seed.json`             | Naskh / Thuluth / Diwani / Kufic style cards (description + sample image path).                             |
| `seed/style-samples/`               | Public-domain calligraphic sample images (deferred — currently empty).                                      |

## License / attribution

- Amiri: SIL Open Font License 1.1. The pack ships `OFL.txt` at its
  root (one level up from this folder). The `vendor/Amiri-Regular.ttf`
  is the build-time input only; the runtime woff2 lives at
  `corpan/packs/rasmapan/assets/fonts/Amiri-Regular.woff2`.
- Style sample images, when added: Wikimedia Commons (public domain).
  Attribution in the pack's `LICENSES.md`.
