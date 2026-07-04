# dja/journey_pack — Journey course-pack pipeline

Builds, validates, and publishes **Journey course packs** — data-only SQLite
content packs carrying a per-target-language curriculum graph. The normative
spec is `corpan/docs/journey/specs/course-pack.md` (format, DDL, gates,
distribution); this directory is its implementation.

Sibling of `dja/word_pack/` / `dja/hanzi_pack/`, with one deliberate
difference: the **publisher lives in-repo** (the out-of-repo wordpan publisher
is a documented mistake).

## Layout

```
journey_pack/
├── journey_common.py          shared: ItemRef helpers, DDL, ACTIVITY_TYPES
│                              (parsed from the SYNCED contract copy), 54-list
├── build_journey_pack.py      authored files + corpora → course.sqlite3 + zip
├── validate_journey_pack.py   the merged gate list V-1..V-20 (CLI + importable)
├── publish_journey_pack.py    S3 upload, immutability check, accumulate-merge index
├── recipes.yaml               course-agnostic lesson recipes + slots (shared)
├── courses/<target>/          authored course trees (W7 owns courses/en)
├── fixtures/                  minimal fixture course + built artifact (tests)
└── tests/                     python unit tests (stdlib unittest)
```

## Commands

```bash
# from dja/journey_pack; python needs PyYAML, pydantic, wordfreq (requirements.txt)
python3 build_journey_pack.py en                        # courses/en → dist/
python3 validate_journey_pack.py en [--json]            # all gates, rc!=0 on error
python3 publish_journey_pack.py en --dry-run            # gate + print index entry
python3 publish_journey_pack.py en --channel preview    # real publish (operator)

# fixture chain (what the tests run)
python3 build_journey_pack.py en --course-dir fixtures/course --out fixtures/dist
python3 validate_journey_pack.py en --course-dir fixtures/course --dist fixtures/dist
python3 -m unittest discover -s tests -v
```

## ACTIVITY_TYPES vendoring (R4)

Gate V-8 validates recipe/boss activity types against the contract registry.
We do NOT hand-copy the registry: `journey_common.load_activity_types()` parses
`packs/sdk/activityContract.ts`, which is a **generated** copy kept
byte-identical to the authoritative
`corpan-app/src/contentPacks/activityContract.ts` by
`node packs/sdk/sync-contract.mjs` (`--check` in CI). Drift is therefore
impossible without CI failing first.

## Fixture

`fixtures/course/` is a 3-unit (~40 item) miniature over base-corpus entryIds:
1 Launchpad phonology unit + 2 A1 units, es overlay (contrastive note, cognate
credit, 3 phoneme pairs), grammar micro-graph (3 nodes), rare cards
(delight + etymology), all 54 string languages. `fixtures/dist/` holds the
built artifact **checked in** so the corpan-app loader test
(`src/util/journeyPack.test.ts`) can open it via `node:sqlite` without a
Python step. Regenerate after editing fixture YAML:

```bash
python3 fixtures/gen_strings.py   # passthrough ×54 strings (fixture-only!)
python3 build_journey_pack.py en --course-dir fixtures/course --out fixtures/dist
```

Fixture strings are English passthrough ×54 — acceptable ONLY here; real
course strings are agent-translated source code (house translation rules).

## Documented gate interpretations

- **V-6 "fast forms"** is enforced as display word count ≤ 12; the zipf ≥ 4.3
  content-word floor applies to text-bearing probes (phrase/word). Minted
  grammarNode/phoneme probes carry titles, not sentences, so the zipf floor
  does not apply to them.
- **V-10** applies to units with `auto:` phrase blocks; `new_target` is the
  block's `count`.
- **V-12**'s verbatim-substring check needs the local, non-shipped CEFR
  descriptor corpus at `cefr_reference/descriptors.txt`; when absent the gate
  warns and the substring check is skipped (the ≥1 can-do check still errors).
- **V-17** compares against the newest lower-version zip found in the dist
  dir; the publisher additionally HEADs S3 (immutability, §4.3 step 3).

## Versioning

See course-pack.md §8. Zips are immutable; `items.id` strings are FSRS card
keys on learner devices and may only disappear across a MAJOR bump (V-17
enforced, publisher cross-checks).
