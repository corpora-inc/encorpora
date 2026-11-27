# Standard hand signals

The 19 hand signals of the Standard Method in Appendix A to Subpart CC of
29 CFR 1926, as data and SVG figures for the crane app.

## Import

- Data: `crane/content/tools/signals/signals.json` (schema: `signals.schema.json`)
- Figures: `crane/content/tools/signals/svg/<signal_id>.svg`, referenced by each
  signal's `svg.path` (relative to `signals.json`).

Each SVG has a tight `viewBox`, `role="img"` and a `<title>`, and its single path
is filled with `currentColor`. Inline the SVG (or use it as a CSS mask) so it takes
the text color in light and dark themes; as an `<img src>` it renders black.
`svg.width` and `svg.height` are in source pixels and share one scale, so drawing
every figure at `width / 772` inches keeps the figures in proportion.

`name`, `description` and `caption` are verbatim from the printed figure (line
breaks collapsed to spaces; the en dash kept). `kind`, `motion`, `crane_types`,
`modifiers` and `teaching_tip` are editorial aids, not regulatory text;
`teaching_tip.verbatim` is always `false`. The `notes` array quotes the eCFR
sections that govern hand signals; every quote and `section_id` passes
`crane/content/verify/verify.py`.

## Source

- GPO, Code of Federal Regulations, Title 29, Chapter XVII, revised as of
  July 1, 2025 (7-1-25 edition), Part 1926 Subpart CC Appendix A:
  <https://www.govinfo.gov/content/pkg/CFR-2025-title29-vol8/pdf/CFR-2025-title29-vol8-part1926-subpartCC-appA.pdf>
- SHA-256 `4d1b6a76f457e576eacf7f33a8a0494af6c3834c4b6cd547cc20b8bfd0ea4b4b`
- Page 1 (CFR p. 741, graphic ER09AU10.003): 12 signals in a 3 x 4 grid.
  Page 2 (CFR p. 742, graphic ER09AU10.004): 7 signals in a 3 x 3 grid.

The figures are a trace of the printed drawing. Small marks that belong to the
drawing (motion arrows, the dotted arcs that show fingers opening and closing,
the marks between the legs) are kept; scan grain and grid lines are removed.

## License

Public domain. The Code of Federal Regulations is a work of the United States
Government (17 U.S.C. 105). Reproducing it here implies no endorsement by OSHA
or any agency.

## Rebuild

Needs Python 3 with Pillow and PyYAML, plus `pdfimages` (poppler), `potrace` and
`tesseract`. No network.

```sh
curl -o appA-2025.pdf <source URL above>
python build/build_signals.py appA-2025.pdf --index ~/.cache/crane-content/sections.json
python ../../verify/verify.py signals.json
```

The build refuses a PDF whose SHA-256 differs from the pinned edition. It finds
the table grid lines, splits each cell's figure from its caption, traces the
figure with potrace into `svg/`, writes `signals.json`, and OCRs every caption
against the transcription in `build/signals.src.yaml`. The OCR comparison and
the measured dash width for each signal are written to `build/VERIFY.md`; the
build fails on any OCR difference that has no recorded resolution. Pass
`--work DIR` to keep the intermediate crops. Output is byte-for-byte
reproducible.

To change a caption, classification or tip, edit `build/signals.src.yaml` and
rebuild; do not edit `signals.json` by hand.
