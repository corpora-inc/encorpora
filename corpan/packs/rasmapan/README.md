# Rasmapan

Arabic-writing pack for Corpan. Sister to Hanzipan: an abjad-aware
handwriting studio with a beginner-friendly intro to the Arabic
alphabet, four-positional-form letter tracing, lam-alif ligature,
common-word tracing, and notes on the four classical calligraphic
styles (Naskh, Thuluth, Diwani, Kufic).

## Contents

- `manifest.json` — pack manifest
- `dist/app.js` / `dist/app.css` — bundled UI + handwriting surface
- `data/arabic.sqlite3` — pack-owned letter + stroke + lesson DB
- `assets/fonts/Amiri-Regular.woff2` — Naskh display font (SIL OFL 1.1)
- `OFL.txt` — Amiri font license
- `LICENSES.md` — third-party attributions for shipped assets

## Build the pack DB

```bash
python3 corpan/packs/rasmapan/build/build_arabic_pack.py
```

See `build/README.md` for builder details (seed files, Amiri TTF
input, fontTools install).

## Dev

`npm run dev:corpan` rebuilds on save and serves the pack at
`http://localhost:8989/rasmapan/manifest.json`. Install it inside
Corpan via the dev manifest URL input (Settings → tap "Corpan" 7×).
