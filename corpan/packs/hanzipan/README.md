# Hanzipan

Mandarin character learning pack for Corpan.

## Contents

- `manifest.json` - pack manifest
- `index.js` / `styles.css` - UI + handwriting surface
- `data/hanzi.sqlite3` - pack-owned stroke + etymology DB

## Build the pack DB

```bash
python3 encorpora/corpan/dja/hanzi_pack/build_hanzi_pack.py
```

## Dev

The dev server serves this pack at:

```
/packs/hanzipan/manifest.json
```
