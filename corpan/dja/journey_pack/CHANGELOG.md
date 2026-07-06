# Changelog — Journey course-pack pipeline (dja/journey_pack)

Pipeline tooling changes are documented here. Per-course CONTENT changes go
in `courses/<target>/CHANGELOG.md` next to the authored source (the course
pack is the shippable unit; see `corpan/docs/journey/specs/course-pack.md`
§4.3 and `corpan/CHANGELOGS.md`).

## [Unreleased]

### Added
- **Word glosses + full-L1 coverage gates (Journey v0.2, contract #1).**
  `course.yaml` gains `l1_full_support` (the L1s carrying a complete native
  face); it rides into `pack_meta`. `wg.<word>` gloss keys flow through
  `compile_strings` into the existing `strings` table (schema stays 1 —
  OTA-safe; old apps ignore unknown keys). Two new publish-blocking gates:
  **V-21** (every word item — pinned + auto-expanded — has `wg.<word>` in `en`
  + every `l1_full_support` lang; sparse elsewhere, the deliberate V-5
  exception) and **V-22** (every base-corpus phrase item has a `cor_translation`
  row for every `l1_full_support` lang). `Corpus.has_translation()` added for
  V-22. Fixture `gen_strings.py` enumerates word items (incl. auto blocks) and
  emits sparse `wg.*` so both gates run in tests.

### Fixed
- **Journey W10 — builder seams (W7's notes).** (a)
  `Corpus.phrase_pack_texts()` now also reads the legacy `english` key
  (34 of 36 legacy packs' `phrases.json` carry ONLY `english` — pins into
  those packs previously resolved to empty text; the two currently-pinned
  packs carry `text`, so `journey_en` output is unchanged). (b) `_seed_b`'s
  CEFR-center clamp is floored at the V-14 difficulty-sanity bound (-4.0) —
  the preA1/A0 band (center −3.5 − 0.7 = −4.2) could otherwise emit an
  out-of-range `b` for low-frequency preA1 word items and fail the gate.
  Rebuilt + revalidated: 19 PASS + V-12 WARN (CEFR descriptor reference not
  shipped) only.

### Added
- Initial pipeline (Journey W6, course-pack.md): `build_journey_pack.py`
  (authored YAML/JSON + corpora → `course.sqlite3` + zip, deterministic,
  full §2 DDL incl. build-time `text_len`), `validate_journey_pack.py`
  (the merged publish-blocking gate list V-1..V-20; ACTIVITY_TYPES vendored
  by parsing the synced `packs/sdk/activityContract.ts` copy — no hand
  copy), `publish_journey_pack.py` (in-repo: validation-gated, S3
  immutability check, accumulate-merge index, `--dry-run`), shared
  `recipes.yaml`, and a 3-unit/41-item fixture course over base-corpus
  entryIds (built artifact checked in for the corpan-app loader test).
