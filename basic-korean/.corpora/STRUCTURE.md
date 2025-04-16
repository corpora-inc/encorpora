# STRUCTURE.md

Each file follows the format:
`NN-MM-{type}-{slug}.md`
Where:
- `intro` files begin each unit (MM = 00)
- `lesson` and `culture` files follow

## Header Rules

- `intro` files: start with `#` (H1) — this is the unit title
  → only file type allowed to use `#`
- `lesson` and `culture` files: start with `##` (H2)
  → never use `#` in these files
- Subsections may use `###` and below

## TOC Behavior

- Pandoc uses `--toc-depth=2`
- H1 (`#`) = unit title
- H2 (`##`) = lesson or culture section title
- Consistency is required for correct PDF output
