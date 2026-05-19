# Rasmapan — third-party attributions

## Amiri (font)

Naskh-style Arabic display font. Used for hero glyphs, letter
pills, word chips, lesson highlights, and the calligraphic-style
preview text. License: **SIL Open Font License v1.1**.

- Source: https://github.com/aliftype/amiri
- License text: `OFL.txt` (shipped inside the pack).
- Files: `assets/fonts/Amiri-Regular.woff2` at runtime;
  `build/vendor/Amiri-Regular.ttf` at build time (the builder
  extracts glyph outlines from this TTF via fontTools).

## Calliar (stroke-order data)

Canonical stroke trajectories animated as the in-app stroke-order
preview come from **Calliar**, an open dataset of online Arabic
calligraphy by [ARBML](https://github.com/ARBML). License:
**MIT**.

- Source: https://github.com/ARBML/Calliar
- License text: `build/vendor/calliar/LICENSE.txt`
- Dataset paper: "Calliar: An Online Handwritten Dataset for
  Arabic Calligraphy" — Z. Alyafeai et al., arXiv:2106.10745
- What we derive: per-primitive median polylines (alif, baa-base,
  haa-base, daal, raa, siin-base, Saad, ain, qaaf-base, kaaf,
  laam, miim, haa, waaw, yaa-base, nuun-base, hamza, Saad-medial,
  plus dot strokes), picked from the corpus by canonical
  aspect-ratio bands + path-length sanity bounds + tortuosity
  (path length ÷ bbox diagonal) — the cleanest curve wins. All
  28 Arabic letters are composed from these primitives:
  single-primitive letters use the canonical trajectory directly;
  composite letters (baa, taa, thaa, jiim, khaa, dhaal, zaay,
  shiin, Daad, ghain, faa, qaaf, nuun, yaa) place dot strokes at
  bbox-relative positions; two-primitive composites (Taa, DHaa)
  lift adjacent stroke pairs from Calliar samples to preserve the
  spatial relationship between stem and base. Trajectories are
  normalized to rasmapan's 0..1000 viewBox. The build-side
  extractor lives at `build/extract_calliar_strokes.py`; visual
  audit tooling at `build/audit_strokes.py` writes per-letter
  SVGs + a 28-letter grid to `build/vendor/calliar/audit/`.
- The raw `dataset.zip` is not committed (51 MB build input);
  run `build/vendor/calliar/fetch_dataset.sh` to download it.
- Composite-letter stroke order follows classical Naskh
  convention (base shape first, then dots) — we re-order
  per-primitive trajectories to honor that rule even when
  individual Calliar writers happened to record dots first.

## Calligraphic-style sample images

The four style cards (Naskh, Thuluth, Diwani, Kufic) show
historical-manuscript photographs sourced from Wikimedia Commons,
all in the **public domain** (PD-old, works whose authors died
more than 70 years ago):

- **Naskh** — `assets/styles/naskh-sample.jpg`: "A folio of the
  Qur'an in Naskh script" by calligrapher Zayno'l-‘Abedin
  Esfahani. Public domain.
  Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:A_folio_of_the_Qur%27an_in_Naskh_script.jpg)

- **Thuluth** — `assets/styles/thuluth-sample.jpg`: Thuluth
  calligraphy by Yaqut al-Musta'simi (13th century, d. 1296).
  Public domain.
  Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Thuluth_-_Yaqut_al-Mustasimi.jpg)

- **Diwani** — `assets/styles/diwani-sample.jpg`: Ferman
  (imperial decree) of Sultan Mehmed II (15th century, r. 1451–1481).
  Public domain via the Google Art Project.
  Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Unknown_scribe_-_Ferman_(imperial_decree)_of_Sultan_Mehmed_II_(r._1451-1481)_-_Google_Art_Project.jpg)

- **Kufic** — `assets/styles/kufic-sample.jpg`: Kufi-script
  parchment with Qur'anic verses (early Islamic period). Public
  domain.
  Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Kufi_script_(D.Va)_on_parchment_(Qur%27anic_verses).jpg)

All four images are resized to ≤ 800 px on the longer side and
JPEG-recompressed at quality 75 for pack-size economy. Originals
on Wikimedia are higher resolution if you need them.

## Corpan host

The pack consumes corpan's host i18next instance
(`window.__corpanI18n`) and the host's SQLite corpus via
`hostApi.searchEntriesByText`. Those are provided by
corpan-app, not by this pack.
