# Changelog — Journey course-pack pipeline (dja/journey_pack)

Pipeline tooling changes are documented here. Per-course CONTENT changes go
in `courses/<target>/CHANGELOG.md` next to the authored source (the course
pack is the shippable unit; see `corpan/docs/journey/specs/course-pack.md`
§4.3 and `corpan/CHANGELOGS.md`).

## [Unreleased]

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
