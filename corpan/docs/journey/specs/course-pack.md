# Journey Course Pack — Format, Builder, Distribution, App Integration

**Status: v1.0 implementable spec. Elaborates ARCHITECTURE D6 + D10 (and the pack-facing
halves of D3/D4/D11). Decisions in ARCHITECTURE.md are taken as settled here.**

Verified against: `dja/word_pack/` + `packs/wordpan/manifest.json` + the out-of-repo
wordpan publisher (`/home/skyl/wordpack_seed/publish_word_pack.py`),
`corpan-app/src/contentPacks/wordPackCatalog.ts`, `corpan-app/src/util/wordPack.ts`,
`corpan-app/src/store/phrasePacks.ts`, `dja/cor/models.py`, `dja/cor/packs/service.py`,
`docs/journey/codebase/content-data.md`, `research/curriculum-spine.md`,
`research/pedagogy.md`, `research/adaptivity.md`.

---

## 0. Overview

A **Journey course pack** is a data-only content pack, one per **target language**:

- **id**: `journey_<target>` with hyphens→underscores in subtags — `journey_en`,
  `journey_es`, `journey_zh_hans`. Underscore-canonical, per the installer's id-derivation
  rule (`util/wordPack.ts:34` comments; we always pass an explicit `packId` anyway).
- **contents**: one read-only SQLite database carrying the curriculum graph — arcs, units,
  skill DAG, grammar-node graph, the item table (ItemRef + static difficulty `b` + intro
  order + importance + probe flags), lesson recipes, rare-card economy, checkpoints, L1
  overlays, and a 54-language strings table. **No JS, no audio, no learner state.**
- **built by**: `dja/journey_pack/` (new; sibling of `dja/word_pack/`, `dja/hanzi_pack/`).
  Unlike wordpan, the **publisher lives in-repo** — the out-of-repo wordpan publisher is a
  documented mistake (`content-data.md` §10).
- **distributed**: immutable ZIP at `s3://corpan-prod/artifacts/corpan/journey-packs/`,
  discovered via its own `index.json` (accumulate-merge, `max-age=300`), never in the main
  catalog, never on Home.
- **consumed**: `corpan-app/src/contentPacks/journeyPackCatalog.ts` (clone of
  `wordPackCatalog.ts`) + `content_packs_install_from_url` +
  `content_packs_query_db`. **Zero Rust changes.**

The pack is the *course*; the engine (`corpan-app/src/journey/engine/`) reads it; learner
state (FSRS cards, θ, review log) lives app-side in IndexedDB per D5 and never in the pack.

---

## 1. ItemRef — canonical serialization

D3 defines `ItemRef = { kind, source, id }`. The pack (and the engine's FSRS key space)
uses ONE canonical string serialization, which is also `items.id`:

```
<kind>:<source>:<id>
```

The kind/source/id table lives in **activity-contract.md §1** — one table, one source
of truth (R2); this spec and engine.md cite it rather than duplicating it. Pack-facing
reminders (all normative in the contract table):

- `char` items use source **`hanzipan`** — `char:hanzipan:好`.
- `phoneme` ids use the sorted-IPA contrast form — `phoneme:journey_en:iː-ɪ`.
- `phrase` source is `base` or a phrase-pack id; `word` source is the target lang code;
  `segment` source is the bookId; `grammarNode`/`phoneme` source is the course id.

Rules:

- `kind` and `source` never contain `:`; `id` may (split on the first two colons only).
- **items.id strings are immutable forever** — they are FSRS card keys on learner devices
  (D5). Removing or renaming one is a MAJOR version event (§8).
- `grammarNode` and `phoneme` items are *minted by* the course pack (D3); everything else
  is a reference into existing content, never a fork.
- **One helper (R2).** The single serializer `itemRefKey()` (and its inverse
  `parseItemRef()`) lives in `contentPacks/activityContract.ts`; this spec defines NO
  duplicate helper and app code imports the contract's. Required cross-spec test: every
  pack `items.id` round-trips through that one helper
  (`itemRefKey(parseItemRef(id)) === id`) — enforced by gate V-15 (§6.4).

---

## 2. SQLite schema (DDL) — `data/course.sqlite3`

Conventions carried over from the phrase-pack builder
(`tools/phrase-packs/build_phrase_pack.py:275-325`): `application_id` = `CORP`,
`user_version` = journey schema version, a `pack_meta(key,value)` table, `WITHOUT ROWID`
on hot composite-PK tables. FKs are declared for documentation + build-time
`PRAGMA foreign_key_check`; the app opens the DB read-only so enforcement cost is nil.

```sql
PRAGMA application_id = 0x434F5250;   -- "CORP"
PRAGMA user_version   = 1;            -- journey course SCHEMA_VERSION (mirror of pack_meta)
PRAGMA journal_mode   = OFF;          -- build-time only; shipped file is read-only
PRAGMA page_size      = 4096;

------------------------------------------------------------------------------
-- meta
------------------------------------------------------------------------------
CREATE TABLE pack_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
) WITHOUT ROWID;
-- Required rows (builder writes all of these):
--   schema_version    '1'                 -- breaking-format counter (§8)
--   course_id         'journey_en'
--   target_lang       'en'
--   content_version   '0.1.0'             -- == manifest.version == index version
--   generated_at      ISO8601
--   builder_git_sha   short sha of corpan repo at build time
--   arc_count / unit_count / item_count / skill_count / string_lang_count
--   string_langs      comma-joined 54-code list actually present
--   corpus_base_sha   sha256 of dja/release.sqlite3 used to resolve refs
--   launchpad_units   e.g. '2'             -- variable-length Launchpad knob
--   script_track      '0' | '1'            -- parallel script lane present (zh/ja/ar…)

------------------------------------------------------------------------------
-- spine: arcs → units
------------------------------------------------------------------------------
CREATE TABLE arcs (
    id          TEXT    PRIMARY KEY,          -- 'en.arc1'
    arc_index   INTEGER NOT NULL UNIQUE,      -- 0..6 (0 = Launchpad)
    cefr        TEXT    NOT NULL
                CHECK (cefr IN ('preA1','A1','A2','B1','B2','C1','C2')),
    title_key   TEXT    NOT NULL              -- strings key ("Foundations")
);

CREATE TABLE units (
    id               TEXT    PRIMARY KEY,     -- 'en.a1.u07'
    arc_id           TEXT    NOT NULL REFERENCES arcs(id),
    unit_index       INTEGER NOT NULL,        -- 1-based order within the arc
    theme_key        TEXT    NOT NULL,        -- strings key ("Every day")
    cando_keys_json  TEXT    NOT NULL,        -- JSON array of strings keys; PARAPHRASED
                                              -- CEFR can-dos (licensing: never verbatim
                                              -- CoE text until cleared — ARCHITECTURE
                                              -- "parked" list)
    vocab_rank_lo    INTEGER,                 -- frequency-band floor (NULL: non-lexical
    vocab_rank_hi    INTEGER,                 --   units, e.g. pure phonology Launchpad)
    phrase_domains_json TEXT,                 -- JSON array: ["phrase-learning", ...] —
                                              -- render-time sampling hint, not a hard ref
    anchor_provider  TEXT,                    -- pack id of the anchor experience (D8),
                                              -- e.g. 'lingo_hero'; NULL = none
    anchor_config_json TEXT,                  -- opaque params for ActivitySpec.params
    UNIQUE (arc_id, unit_index)
);
CREATE INDEX idx_units_arc ON units(arc_id, unit_index);

------------------------------------------------------------------------------
-- skill DAG (what the engine walks; mastery is DERIVED over a skill's items — D4)
------------------------------------------------------------------------------
CREATE TABLE skills (
    id            TEXT PRIMARY KEY,           -- 'en.skill.present-simple'
    unit_id       TEXT NOT NULL REFERENCES units(id),  -- home unit (where introduced)
    kind          TEXT NOT NULL
                  CHECK (kind IN ('grammar','vocab','phonology','script','function')),
    title_key     TEXT NOT NULL,              -- strings key
    difficulty_b  REAL NOT NULL               -- b_s: logit-scale, A1 core ≈ −3 … C2 ≈ +4
);
CREATE INDEX idx_skills_unit ON skills(unit_id);

-- Edge direction: from_skill is a PREREQUISITE of to_skill.
CREATE TABLE skill_edges (
    from_skill TEXT NOT NULL REFERENCES skills(id),
    to_skill   TEXT NOT NULL REFERENCES skills(id),
    PRIMARY KEY (from_skill, to_skill),
    CHECK (from_skill <> to_skill)
) WITHOUT ROWID;
CREATE INDEX idx_skill_edges_to ON skill_edges(to_skill);

------------------------------------------------------------------------------
-- grammar-node graph (~300 ordered nodes per course at full build; A1 slice in v0.1)
------------------------------------------------------------------------------
CREATE TABLE grammar_nodes (
    id            TEXT    PRIMARY KEY,        -- 'en.gn.present-simple-3sg'
    skill_id      TEXT    NOT NULL REFERENCES skills(id),
    node_order    INTEGER NOT NULL UNIQUE,    -- global processability order (teachability
                                              -- sequence, pedagogy.md §6)
    cefr          TEXT    NOT NULL,
    title_key     TEXT    NOT NULL,           -- strings key
    note_key      TEXT    NOT NULL,           -- strings key: the ≤60-second rule card,
                                              -- localized ×54 (L1-language explanation)
    late_acquired INTEGER NOT NULL DEFAULT 0  -- 1 = track + recycle, NEVER gate on it
                                              -- (e.g. en 3rd-person -s; pedagogy §6)
);
CREATE INDEX idx_grammar_nodes_skill ON grammar_nodes(skill_id);

------------------------------------------------------------------------------
-- items: the FSRS-addressable universe (the heaviest table)
------------------------------------------------------------------------------
CREATE TABLE items (
    id            TEXT    PRIMARY KEY,        -- serialized ItemRef (§1) — IMMUTABLE
    kind          TEXT    NOT NULL
                  CHECK (kind IN ('phrase','word','char','segment',
                                  'grammarNode','phoneme','concept')),
    source        TEXT    NOT NULL,           -- ItemRef.source
    ref_id        TEXT    NOT NULL,           -- ItemRef.id
    unit_id       TEXT    NOT NULL REFERENCES units(id),   -- unit of introduction
    intro_order   INTEGER NOT NULL UNIQUE,    -- global introduction sequence across the
                                              -- whole course (frequency-driven for lexical
                                              -- items; processability-driven for grammar)
    difficulty_b  REAL    NOT NULL,           -- static IRT difficulty (D4): seeded from
                                              -- CEFR band + freq rank at build time
    importance    INTEGER NOT NULL DEFAULT 2
                  CHECK (importance BETWEEN 0 AND 3),
                                              -- 3 core / 2 standard / 1 enrichment /
                                              -- 0 rare-card-only. Drives retention target
                                              -- (0.90 core vs 0.85 long-tail, pedagogy §3)
                                              -- and encounter-injection priority.
    is_probe      INTEGER NOT NULL DEFAULT 0, -- placement probe (adaptivity §4.2): fast
                                              -- forms only, unambiguous, auto-scoreable
    substitutable INTEGER NOT NULL DEFAULT 0, -- leech-swap eligible same-skill alternate
                                              -- (adaptivity §6.4)
    freq_rank     INTEGER,                    -- wordfreq rank in the TARGET language;
                                              -- NULL for non-lexical items
    text_len      INTEGER NOT NULL DEFAULT 0, -- BUILD-TIME (R7): NFC code-point length of
                                              -- the item's target-language display text
                                              -- (phrase/segment text, word surface,
                                              -- char = 1; minted grammarNode/phoneme items
                                              -- use their en title). Feeds
                                              -- CourseGraph.items[].textLen for the
                                              -- engine's latency normalization.
    UNIQUE (kind, source, ref_id)
);
CREATE INDEX idx_items_unit  ON items(unit_id);
CREATE INDEX idx_items_intro ON items(intro_order);
CREATE INDEX idx_items_probe ON items(is_probe) WHERE is_probe = 1;

-- An item may serve multiple skills (D4: "an item may belong to multiple skills;
-- count it in each"). Mastery(s) is derived over I(s) = this join.
CREATE TABLE item_skills (
    item_id  TEXT NOT NULL REFERENCES items(id),
    skill_id TEXT NOT NULL REFERENCES skills(id),
    PRIMARY KEY (item_id, skill_id)
) WITHOUT ROWID;
CREATE INDEX idx_item_skills_skill ON item_skills(skill_id);

------------------------------------------------------------------------------
-- lesson recipes (slot templates the on-device renderer fills — curriculum §2.4)
------------------------------------------------------------------------------
CREATE TABLE lesson_recipes (
    id          TEXT PRIMARY KEY,   -- 'core','story','dialog','grammar-focus',
                                    -- 'phonology','review','boss','gem'
                                    -- ('story' is SCHEMA-ONLY in v0.1 — R11: no v0.1
                                    -- unit schedules it; returns with the v0.2
                                    -- coverage workstream)
    title_key   TEXT NOT NULL,      -- strings key
    est_minutes REAL NOT NULL       -- median engaged minutes (feed pacing hint)
);

CREATE TABLE recipe_slots (
    recipe_id      TEXT    NOT NULL REFERENCES lesson_recipes(id),
    slot_index     INTEGER NOT NULL,          -- 0-based order within the lesson
    slot_type      TEXT    NOT NULL,          -- strand-bearing slot taxonomy:
                                              -- 'review.retrieve' | 'input.listen' |
                                              -- 'input.read' | 'input.picture' |
                                              -- 'practice.pick' | 'practice.match' |
                                              -- 'practice.order' | 'practice.cloze' |
                                              -- 'practice.minimal-pair' |
                                              -- 'produce.speak' | 'produce.write' |
                                              -- 'produce.translate' |
                                              -- 'fluency.game-round' | 'fluency.shadow' |
                                              -- 'fluency.timed-review' |
                                              -- 'grammar.note' | 'meta.recap'
    activity_types_json TEXT NOT NULL,        -- JSON array of activityType values the
                                              -- mixer may choose among for this slot;
                                              -- each ∈ the ACTIVITY_TYPES registry in
                                              -- activityContract.ts (R4) or a pack type
                                              -- `<packId>:<name>` — gate V-8
    item_selector  TEXT    NOT NULL
                   CHECK (item_selector IN ('due','new','unit','known','grammar-node',
                                            'l1-phoneme','rare','none')),
                                              -- pool the renderer draws itemRefs from
    params_json    TEXT,                      -- selector/activity params (count, form
                                              -- ceiling, coverage floor, timebox…)
    optional       INTEGER NOT NULL DEFAULT 0,-- 1 = droppable under modelNeeds pressure
                                              -- (D8 model-residency batching) or skip
    PRIMARY KEY (recipe_id, slot_index)
) WITHOUT ROWID;

-- Ordered lesson plan per unit ('lessons:' list in the unit YAML). Bosses are NOT
-- rows here — they live in checkpoints (exactly one per unit) and the feed appends
-- the boss after the final lesson.
CREATE TABLE unit_lessons (
    unit_id      TEXT    NOT NULL REFERENCES units(id),
    lesson_index INTEGER NOT NULL,             -- 0-based
    recipe_id    TEXT    NOT NULL REFERENCES lesson_recipes(id),
    params_json  TEXT,                         -- per-instance overrides (e.g. story
                                               -- segment range, dialog script key)
    PRIMARY KEY (unit_id, lesson_index)
) WITHOUT ROWID;

------------------------------------------------------------------------------
-- checkpoints: unit bosses + arc gates (both are tasks, not tests — pedagogy §9)
------------------------------------------------------------------------------
CREATE TABLE checkpoints (
    id          TEXT PRIMARY KEY,             -- 'en.a1.u07.boss' | 'en.arc1.gate'
    scope       TEXT NOT NULL CHECK (scope IN ('unit','arc')),
    unit_id     TEXT REFERENCES units(id),    -- set iff scope='unit'
    arc_id      TEXT REFERENCES arcs(id),     -- set iff scope='arc'
    recipe_id   TEXT NOT NULL REFERENCES lesson_recipes(id),  -- usually 'boss'
    pass_score  REAL NOT NULL DEFAULT 0.8,
    params_json TEXT,                          -- gauntlet make-up: required slot minima
                                               -- (≥1 produce.speak, ≥1 pure listening),
                                               -- spaced-sample share, gate rubric refs,
                                               -- test-out limits (mistakes cap, no hints)
    CHECK ((scope = 'unit') = (unit_id IS NOT NULL)),
    CHECK ((scope = 'arc')  = (arc_id  IS NOT NULL))
);
CREATE UNIQUE INDEX idx_checkpoints_unit ON checkpoints(unit_id) WHERE unit_id IS NOT NULL;
CREATE UNIQUE INDEX idx_checkpoints_arc  ON checkpoints(arc_id)  WHERE arc_id  IS NOT NULL;

------------------------------------------------------------------------------
-- rare-card economy (D7: variable-ratio rewards; rarity NEVER purchasable)
------------------------------------------------------------------------------
CREATE TABLE rare_cards (
    id            TEXT    PRIMARY KEY,        -- 'en.rare.gem.serendipity'
    card_type     TEXT    NOT NULL
                  CHECK (card_type IN ('delight','minigame','etymology','story')),
                                              -- 'story' (storyChapter) is SCHEMA-ONLY in
                                              -- v0.1 (R11): zero story rows ship until the
                                              -- v0.2 graded-narration + known-token-
                                              -- coverage workstream lands (gate V-19)
    rarity_weight INTEGER NOT NULL,           -- draw denominator basis: delight ~8,
                                              -- minigame ~25, etymology ~50 (D7)
    min_unit_id   TEXT REFERENCES units(id),  -- earliest unit at which it may roll
    provider      TEXT,                       -- pack id for minigame/story rolls
                                              -- ('lingo_hero', 'book_monte_alban'…)
    item_id       TEXT REFERENCES items(id),  -- payload item (e.g. word:en:… for gems)
    coverage_gate REAL,                       -- story chapters: measured known-token
                                              -- coverage floor, e.g. 0.95 (D7). v0.2
                                              -- semantics (R11): the coverage computation
                                              -- (Intl.Segmenter + irregular-form map onto
                                              -- word items) is defined by the named v0.2
                                              -- story workstream; unused in v0.1
    params_json   TEXT
);
CREATE INDEX idx_rare_cards_type ON rare_cards(card_type);

------------------------------------------------------------------------------
-- L1 overlays: one spine, per-native scaffolding as DATA (D6 — no 54× forks)
------------------------------------------------------------------------------
CREATE TABLE l1_overlays (
    l1           TEXT NOT NULL,               -- native language code ('es', 'pt-BR'…)
    overlay_type TEXT NOT NULL
                 CHECK (overlay_type IN ('contrastive_note','cognate_credit',
                                         'phoneme_pair')),
    ref_kind     TEXT NOT NULL
                 CHECK (ref_kind IN ('grammarNode','unit','item','course')),
    ref_id       TEXT NOT NULL,               -- grammar_nodes.id / units.id / items.id /
                                              -- course_id (course-wide credits)
    string_key   TEXT,                        -- localized copy in strings under (key, l1)
                                              -- — contrastive notes; NULL for pure data
    payload_json TEXT,                        -- cognate_credit: {"items":[itemId…],
                                              --   "seedForm":0, "stabilityBoost":…}
                                              -- phoneme_pair: {"contrast":"iː-ɪ",
                                              --   "minimalPairs":[["ship","sheep"],…]}
    PRIMARY KEY (l1, overlay_type, ref_kind, ref_id)
) WITHOUT ROWID;
CREATE INDEX idx_l1_overlays_l1 ON l1_overlays(l1);

------------------------------------------------------------------------------
-- strings: all learner-visible COURSE copy, 54 languages
-- (exercise-chrome UI strings stay in app i18n `public/locales/*` — §7.4)
------------------------------------------------------------------------------
CREATE TABLE strings (
    key  TEXT NOT NULL,     -- namespaced: 'arc.en.arc1.title', 'unit.en.a1.u07.theme',
                            -- 'gn.en.gn.present-simple-3sg.note',
                            -- 'skill.en.skill.present-simple.title',
                            -- 'cando.en.a1.u07.routines',
                            -- 'ovl.es.gn.present-continuous.note' (l1-scoped)
    lang TEXT NOT NULL,     -- one of the canonical 54 codes (settings.ts ALL_LANGUAGES)
    text TEXT NOT NULL,
    PRIMARY KEY (key, lang)
) WITHOUT ROWID;
```

### 2.1 PackReader → CourseGraph (NORMATIVE loader contract — R7)

The engine consumes the plain, JSON-serializable `CourseGraph` object (engine.md §2.6);
the `journey/store` PackReader builds it from this DB via
`content_packs_query_db(packId, "main", sql, params, maxRows)` — parameterized,
read-only, connection-cached (`src-tauri/src/lib.rs:1102`).

**Pagination is mandatory.** `content_packs_query_db` hard-caps at **2,000 rows and
truncates SILENTLY** (`lib.rs:30-31, 1147-1148`). At v0.1 scale `items` (~4,200 rows)
and `item_skills` (~6,000 rows) both exceed the cap. Every read of those tables uses
**keyset pagination**: page size 1,000, loop until a short page (< 1,000 rows) returns.
Never `OFFSET`; never assume a full page is the last.

Exact SQL per CourseGraph field:

```sql
-- graph.arcs (arcId, ordinal, cefr) — single shot, ≤ 7 rows
SELECT id, arc_index, cefr FROM arcs ORDER BY arc_index;

-- graph.units (unitId, arcId, ordinal; skillIds derived from the skills rows)
SELECT id, arc_id, unit_index FROM units ORDER BY arc_id, unit_index;

-- graph.skills (skillId, b, unitId; prereqs from skill_edges; itemIds from item_skills)
SELECT id, unit_id, difficulty_b FROM skills;
SELECT from_skill, to_skill FROM skill_edges;

-- graph.skills[].itemIds + graph.items[].skillIds
-- (~6,000 rows > the 2,000 cap → keyset over the composite PK)
SELECT item_id, skill_id FROM item_skills
WHERE (item_id, skill_id) > (?, ?)
ORDER BY item_id, skill_id LIMIT 1000;

-- graph.items (~4,200 rows > the 2,000 cap → keyset over intro_order)
SELECT id, kind, source, ref_id, unit_id, intro_order, difficulty_b,
       importance, is_probe, substitutable, text_len
FROM items
WHERE intro_order > ?
ORDER BY intro_order LIMIT 1000;
```

Field mapping (normative):

- `itemId` = `id`; `ref` = `parseItemRef(id)` via the ONE contract helper (§1);
  `introOrder` = `intro_order`; `b` = `difficulty_b`; `probe` = `is_probe = 1`;
  `textLen` = `text_len`; `kind` = `kind`.
- **`substituteIds`** — derived in-memory, no extra SQL: for item *i*, the other items
  sharing ≥ 1 skill with *i* that have `substitutable = 1`, **ordered by `intro_order`**.
  Computed from the loaded items × item_skills join.
- **`activityTemplates`** — native-template metadata (`form`, `strand`, `guessable`,
  `estSec`, `modelNeeds`) comes from the vendored `ACTIVITY_TYPES` registry in
  `activityContract.ts` (R4), NOT from this DB; pack recipes contribute only the
  pack-provided `<packId>:<name>` templates and `funWeight`. One metadata source.
- **`importance` — ONE scale.** The pack's 0–3 integer (§2 `items.importance`) is the
  only authored scale. The loader derives the engine weight:

  | pack `importance` | engine weight | meaning |
  |---|---|---|
  | 3 | 2.0 | core |
  | 2 | 1.5 | standard |
  | 1 | 1.2 | enrichment |
  | 0 | 1.0 | rare-card-only — never enters scheduler pools |

  engine.md's "importance 1.0..2.0" is this *derived* weight; there is no second
  authored scale anywhere.

**Row-count assertion (hard boot error).** After pagination completes, loaded counts
MUST equal `pack_meta.item_count` / `skill_count` / `unit_count` / `arc_count`. A
mismatch means silent truncation or a corrupt install: the loader throws, the Journey
surface shows the pack-error state (reinstall path). The engine NEVER boots on a
partial graph — silent truncation is the failure mode this assertion exists to catch.

**Cold-start budget.** Full graph load (all queries above + derived indexes, ~12
paginated calls at v0.1 scale) completes in **< 500 ms on the reference low-end Android
device** at v0.1 scale (~4,200 items). Measured in the slice that lands the loader.

**Per-arc lazy loading (specced now; built before Arc 2 ships).** At full-course scale
(192 units, tens of thousands of items) the eager load blows the budget. Plan sketch:
`intro_order` is arc-contiguous by construction (§6.2 step 4 sorts by arc first), so
each arc is one keyset range. Boot loads the spine (arcs/units/skills/edges) plus the
active arc's item range; adjacent arcs prefetch on idle; `CourseGraph` gains a
`loadedArcs` marker and the loader an `ensureArc(arcId)` promise; the row-count
assertion then applies per arc range (per-arc counts land in `pack_meta` as
`arc_item_counts` JSON). Nothing in v0.1 builds this; the schema and the build sort
order already support it.

Other reads (small, single-shot, well under the cap):

```sql
-- unit entry: item pool for the mixer (≤ ~200 rows)
SELECT id, kind, source, ref_id, difficulty_b, importance, intro_order, text_len
FROM items WHERE unit_id = ? ORDER BY intro_order;

-- placement: probes near a target difficulty
SELECT i.id, i.difficulty_b FROM items i
WHERE i.is_probe = 1 AND i.difficulty_b BETWEEN ? AND ?
ORDER BY ABS(i.difficulty_b - ?) LIMIT 8;

-- localized copy, native-first with en fallback (same contract as
-- util/wordPack.ts::selectPreferred — reuse that selector)
SELECT lang, text FROM strings WHERE key = ?;

-- overlays for the active stack's L1 (≤ ~500 rows)
SELECT overlay_type, ref_kind, ref_id, string_key, payload_json
FROM l1_overlays WHERE l1 = ?;
```

---

## 3. Pack ZIP layout + manifest.json

ZIP contents (exactly the wordpan shape — `packs/wordpan/manifest.json` precedent):

```
journey_en-0.1.0.zip
├── manifest.json
└── data/course.sqlite3
```

`manifest.json`:

```json
{
  "id": "journey_en",
  "name": "Journey: English",
  "version": "0.1.0",
  "entryType": "data",
  "packType": "data",
  "sdkVersion": "0.1.0",
  "databases": { "main": "data/course.sqlite3" },
  "languages": ["en"],
  "journey": {
    "targetLang": "en",
    "schemaVersion": 1
  },
  "nameLocalized": {
    "en": "Journey: English",
    "es": "Journey: inglés"
  },
  "descriptionLocalized": {
    "en": "The complete guided English course.",
    "es": "El curso completo y guiado de inglés."
  }
}
```

Rules:

- `id` is underscore-canonical and immutable; the ZIP filename is the **underscore pack
  id + version suffix** (`journey_en-0.1.0.zip` — installer rule, R1). The app STILL
  ALWAYS passes the explicit `packId` to `content_packs_install_from_url` so the
  installer never derives `journey_en_0_1_0` from the filename (the exact wordpan
  bug-avoidance, `util/wordPack.ts:80-97`).
- `entryType: "data"`, no `entry` field → the pack is not launchable; it never appears in
  the pack browser as an experience.
- `manifest.version` == `pack_meta.content_version` == index `version`. The builder
  enforces this (§6.4 gate V-18).
- `nameLocalized`/`descriptionLocalized` cover all 54 locales at publish (agents translate
  directly, house i18n rule).

---

## 4. Index + S3/CloudFront layout + publish flow

### 4.1 Wire format — `corpan/journey-packs/index.json`

```json
{
  "version": 1,
  "generatedAt": "2026-07-03T00:00:00Z",
  "packs": [
    {
      "id": "journey_en",
      "kind": "journey-course",
      "targetLang": "en",
      "name": "Journey: English",
      "nameLocalized": { "es": "Journey: inglés" },
      "description": "The complete guided English course.",
      "descriptionLocalized": { "es": "El curso completo y guiado de inglés." },
      "version": "0.1.0",
      "schemaVersion": 1,
      "zipUrl": "https://d38iwc9748jekz.cloudfront.net/corpan/journey-packs/journey_en-0.1.0.zip",
      "sha256": "…",
      "sizeMb": 2.8,
      "unitCount": 30,
      "itemCount": 4200,
      "arcMax": "A1",
      "minAppVersion": "0.9.0",
      "channel": "preview"
    }
  ]
}
```

`schemaVersion` rides in the index (not only inside the DB) so the app can refuse a pack
**before** downloading it (§7.2).

### 4.2 S3 / CloudFront

Bucket `corpan-prod`, CF `d38iwc9748jekz.cloudfront.net`, `origin_path=/artifacts`
(`infra/terraform/main.tf:396`) — S3 key `artifacts/X` serves at `/X`. No Terraform
changes needed (public, unsigned, same as word packs):

```
s3://corpan-prod/artifacts/corpan/journey-packs/
├── index.json                      Cache-Control: public,max-age=300
├── journey_en-0.1.0.zip            Cache-Control: public,max-age=31536000,immutable
└── journey_en-0.2.0.zip            (older versions stay forever; zips are immutable)
```

### 4.3 Publish flow — `dja/journey_pack/publish_journey_pack.py` (IN-REPO)

Clone of `/home/skyl/wordpack_seed/publish_word_pack.py` mechanics, relocated in-repo and
hardened:

```
usage: python3 publish_journey_pack.py <target> [--dry-run] [--channel preview]
e.g.:  python3 publish_journey_pack.py en
```

Steps (each is a function; the script is idempotent):

1. **Build or verify** `dist/journey_<target>-<ver>.zip` exists (calls
   `build_journey_pack.py` if absent; refuses to publish a zip whose sha differs from a
   freshly rebuilt one unless `--allow-stale`).
2. **Run the validator** (§6.4) — publish is gated on ALL validation gates passing.
   `--dry-run` stops here and prints the would-be index entry.
3. **Immutability check**: `HEAD s3://…/journey_<target>-<ver>.zip`; if the key exists
   with a different sha256 → hard abort ("bump the version"). Same sha → skip upload.
4. **Upload zip** with `Cache-Control: public,max-age=31536000,immutable`.
5. **Accumulate-merge index**: GET current `index.json` (create
   `{"version":1,"packs":[]}` if 404), replace-or-append this pack's entry keyed by `id`,
   never touching other entries, sort by `id`, PUT with `max-age=300`.
6. Print the CDN URL + entry for the changelog.

AWS credentials: read from `~/.env` (`AWS_ACCESS_KEY` / `AWS_SECRET_ACCESS_KEY`, same
loader as the wordpan publisher). Region `us-east-2`.

Changelog rule: the course pack is a shippable unit. `CHANGELOG.md` lives at
`dja/journey_pack/courses/en/CHANGELOG.md` (next to the authored source, since the
manifest is generated); every content change adds an `[Unreleased]` line before PR, per
`corpan/CHANGELOGS.md`.

---

## 5. Authoring inputs (source of truth, checked into git)

Directory layout:

```
dja/journey_pack/
├── README.md
├── recipes.yaml                    # course-agnostic lesson recipes + slots (shared)
├── build_journey_pack.py           # authored files + corpora → course.sqlite3 + zip
├── validate_journey_pack.py        # all gates (§6.4); importable + CLI
├── publish_journey_pack.py         # §4.3
└── courses/
    └── en/
        ├── CHANGELOG.md
        ├── course.yaml             # course_id, target_lang, arcs, launchpad_units,
        │                           # script_track flag, manifest name/description seeds
        ├── grammar.yaml            # the grammar-node graph (D10 #2): id, skill, order,
        │                           # cefr, late_acquired, en note text
        ├── units/
        │   ├── a0-u01-sounds.yaml  # one file per unit (schema §5.1)
        │   └── …
        ├── overlays/
        │   └── es.yaml             # per-L1: contrastive notes (en source text),
        │                           # cognate credit lists, phoneme pairs
        └── strings/
            ├── en.json             # canonical copy, key → text
            ├── es.json             # agent-translated, checked in
            └── … (54 files)        # translations are SOURCE CODE (memory rule):
                                    # authored/agent-written, git-tracked, never derived
```

Strings are JSON (not YAML) deliberately — sidesteps the Norwegian `no`-as-boolean YAML
trap for the `no.json` locale and keeps agents' disjoint-file fan-out translation
workflow identical to `public/locales/`.

### 5.1 Unit YAML schema (curriculum-spine §2.5 made exact)

```yaml
id: en.a1.u07
arc: en.arc1
theme: "Every day"                       # becomes strings key unit.en.a1.u07.theme
cando:
  - key: routines                        # → cando.en.a1.u07.routines
    text: "Can describe daily routines and habits."   # PARAPHRASED descriptor
vocab_band: { lo: 320, hi: 400 }
phrase_domains: [phrase-learning]
skills:
  - id: en.skill.present-simple
    kind: grammar
    title: "Present simple"
    b: -2.6
    prereqs: [en.skill.be-statements, en.skill.pronouns]
grammar_nodes: [en.gn.present-simple-12p, en.gn.adverbs-of-frequency,
                en.gn.time-prepositions]      # must exist in grammar.yaml; their
                                              # skill_id must be a skill of this unit
items:
  # explicit refs; `auto:` blocks let the builder fill from corpora
  - ref: "phrase:base:2210"
    skills: [en.skill.present-simple]
    importance: 3
    probe: true
  - auto: { kind: phrase, source: base, domains: [everyday], level: A1,
            rank_band: [320, 400], count: 24, skills: [en.skill.present-simple] }
  - auto: { kind: word, rank_band: [320, 400], count: 45, importance: 2 }
lessons: [core, core, grammar-focus, core, core, phonology,
          core, dialog, review, core]
          # v0.1 has NO 'story' lessons (R11) — units that scheduled them re-pool
          # to listen-heavy input; the recipe returns with the v0.2 story workstream
boss:
  pass_score: 0.8
  params: { spacedSampleShare: 0.3, require: [produce.speak, input.listen] }
anchor: { provider: lingo_hero, config: { itemset: unit } }
          # v0.1 anchors are restricted to the instrumented set (R13, gate V-9)
```

Everything the builder mints (grammarNode/phoneme item rows, string keys, `intro_order`,
seeded `difficulty_b`) is deterministic from these files + the corpora, so rebuilding the
same git tree byte-reproduces the same DB (modulo `generated_at`).

---

## 6. Builder — `dja/journey_pack/build_journey_pack.py`

**Standalone script, NOT Django models** (decision — see "decisions" list). Precedent:
`word_pack/build_word_pack.py` reads `release.sqlite3` directly; the authored YAML/JSON
in git is the editorial source of truth, mirroring the phrase-pack authoring flow
(`pack.json`/`phrases.json`) rather than admin-driven `Pack`/`PackEntry`
(`cor/packs/service.py` remains the phrase fan-out tool; Journey only *references* its
output ids).

```
python3 build_journey_pack.py en \
    [--core-db ../release.sqlite3] \
    [--packs-dir ../../tools/phrase-packs] \
    [--wordpan-seed /home/skyl/wordpack_seed/english_verified.json] \
    [--out dist/] [--skip-validate]
```

### 6.1 Inputs

| Input | Used for |
|---|---|
| `courses/<t>/…` YAML/JSON (§5) | spine, DAG, grammar graph, recipes, overlays, strings |
| `dja/release.sqlite3` | resolve `phrase:base:<id>` refs; `cor_entry.level` as the CEFR prior for `b`; EN text for auto-selection + tokenization |
| `tools/phrase-packs/phrase-*/phrases.json` | resolve `phrase:<packId>:<idx>` refs (array order = immutable id) |
| wordpan seed word list (or `word_pack/extract_words.py` output) | resolve `word:<t>:<w>` refs; etymology-gem rare cards |
| **wordfreq** (MIT, pip) | `freq_rank` per lexical item in the target language (D10 #1): `rank = zipf-ordered index over wordfreq.top_n_list(target, 60000)`; surface-word lookup, lemma work deferred |
| `grammar.yaml` | grammar_nodes + minted `grammarNode:` items |
| `overlays/<l1>.yaml` | l1_overlays rows + `ovl.<l1>.*` strings |

### 6.2 Pipeline (deterministic, pure functions over inputs)

1. Load + schema-check all authored files (pydantic models; hard error on unknown keys).
2. Resolve every explicit `ref:`; expand every `auto:` block against the corpora
   (selection is seeded-stable: sort by `(freq_rank, source, ref_id)`, take `count`).
3. Mint `grammarNode:`/`phoneme:` items (one item per grammar node with
   `kind='grammarNode'`; phoneme items from the union of all overlay `phoneme_pair`
   contrasts — phoneme items are course-wide, `unit_id` = the phonology unit that
   introduces the contrast, Launchpad by default).
4. Assign `intro_order`: stable sort of all items by `(arc_index, unit_index,
   lexical? freq_rank : grammar node_order, id)`.
5. Seed `difficulty_b` where not authored:
   `b = cefr_center(level) + 0.4 * log10(freq_rank/band_center)` clamped to the CEFR
   band ±0.7 — CEFR centers: A0 −3.5, A1 −3, A2 −1.5, B1 0, B2 +1.5, C1 +3, C2 +4
   (adaptivity §2.3 anchors). Authored `b` always wins. These are weak priors by design;
   θ self-corrects (D10 #4).
6. Compile strings: every `title/theme/note/cando/overlay` text becomes a namespaced key;
   merge `strings/<lang>.json` files.
7. Emit SQLite (§2 DDL, including the build-time `text_len` column per item — §2.1),
   `ANALYZE`, `VACUUM`.
8. Emit `manifest.json`, zip → `dist/journey_<t>-<ver>.zip`, print sha256/size.
9. Run `validate_journey_pack.py` on the artifact (unless `--skip-validate`).

### 6.3 Dependencies

`dja/requirements.txt` additions: `wordfreq`, `pyyaml`, `pydantic` (boto3 only for the
publisher). No GPU, no LLM calls at build time — all LLM-drafted content (grammar notes,
contrastive notes, translations) is authored *into git* beforehand (codex-first, per
memory rules), reviewed, then built.

### 6.4 Validation gates (ALL are publish-blocking) — THE one merged list (R1)

Implemented in `validate_journey_pack.py`, runnable against either the authored tree
(fast) or the built sqlite (authoritative); publisher runs the sqlite mode plus the
tree-only gates. **This is the single validation-gate list for Journey packs**:
authoring.md's lint gates (old `V-XXX-n` names) are absorbed and retired here;
authoring.md references this list. Gates marked **(tree)** need the authored tree +
corpora and run pre-build; **(W)** = warn-only.

| # | Gate | Rule |
|---|---|---|
| V-1 | **Every ItemRef resolves** | `phrase:base:*` ∈ `cor_entry`; `phrase:<pack>:*` ∈ that pack's `phrases.json` index range; `word:*` ∈ word universe; `grammarNode:*`/`phoneme:*` ∈ this pack; `segment:*` resolvable against the named book's `segments.json` when the pack dir is on disk, else ERROR (no unverifiable refs ship); `char:*`/`concept:*` ∈ hanzipan seed / imagepan concept list (v0.1: schema-stub, zero rows) |
| V-2 | **Skill DAG acyclic + reachable** | Kahn topo-sort over `skill_edges`; cycle → error listing the cycle. Also: every edge endpoint exists; every non-Launchpad skill reachable from a Launchpad root |
| V-3 | **Grammar-node integrity** | every `grammar_nodes.skill_id` exists and is a skill of the node's home unit; every unit's `grammar_nodes:` id exists in `grammar.yaml`; every non-stub node is introduced by exactly one unit; every prerequisite (via its skill's prereq skills) is introduced in an earlier-or-same-order unit *(absorbs authoring V-NODE-1/2, V-DAG-2)* |
| V-4 | **Unit vocab bands monotone** | ordered by `(arc_index, unit_index)`: `vocab_rank_hi` non-decreasing AND `vocab_rank_lo ≤` previous `hi` + 1 (no gaps, no regressions); NULL-band units skipped *(absorbs V-BAND-1)* |
| V-5 | **Strings complete ×54** | every `*_key` referenced by any table resolves in `strings` for ALL 54 canonical codes (`settings.ts ALL_LANGUAGES` list, vendored as a constant) — EXCEPT `ovl.<l1>.*` keys, which need exactly `(l1, en)` (en = author fallback) |
| V-6 | **Probe coverage + quality** | every skill has 2–4 `is_probe=1` items in `item_skills` (adaptivity §4.2); probe items must have `importance ≥ 2`; probes are fast forms only; every probe instance's content words have zipf ≥ 4.3 *(absorbs V-PROBE-1/2)* |
| V-7 | **Checkpoint totality + boss shape** | exactly one `scope='unit'` checkpoint per unit; exactly one `scope='arc'` gate per arc; every checkpoint's `recipe_id` exists; boss `pass_score` ∈ [0.7, 0.9]; boss required slot minima ⊇ {`produce.speak`, `input.listen`} *(absorbs V-BOSS-1)* |
| V-8 | **Lesson integrity** | every `unit_lessons.recipe_id` exists; every recipe has ≥1 slot; every `slot_type` ∈ taxonomy; every `activity_types_json` value ∈ the **vendored `ACTIVITY_TYPES` constant from `activityContract.ts`** (R4) or matches `<packId>:<name>`; a CI drift check (à la `sync-contract.mjs`) keeps the vendored copy byte-identical to the contract *(absorbs V-RECIPE-1)* |
| V-9 | **Anchor providers** | every `units.anchor_provider` ∈ the known-provider registry with a native fallback; **v0.1 anchors restricted to `lingo_hero`, `earthgate` (or `cap-segment-player`), `corpan_city`, `cap-pronounce`, `cap-squeeze`** (R13); beatlounge/hover_runner/tutomaton/stargate are v0.2 anchor swaps — pack data upgrades independently of the app *(absorbs V-ANCHOR-1)* |
| V-10 | **Item-pool adequacy** (tree) | every teach unit's resolved candidate pool ≥ max(40, 2×new_target) phrases; (W) < 3×new_target; pinned includes exist in their source and are not excluded elsewhere *(absorbs V-POOL-1/2)* |
| V-11 | **Gap-pack band fit** (tree) | gap-pack A0/A1 phrases' content words fall within the consuming unit's rank band ×1.2 *(absorbs V-GAP-1)* |
| V-12 | **Can-do paraphrase-only** | every teach unit has ≥1 can-do; no can-do text contains an 8+-word verbatim substring of the CEFR descriptor corpus (checked against a local, non-shipped reference file) *(absorbs V-CANDO-1)* |
| V-13 | **Copy hygiene** | no banned absolutes ("forever", "never", "100%", "entirely", "always", "guaranteed") and no "flag/flagging" in any user-facing string, any language *(absorbs V-COPY-1; house rules)* |
| V-14 | **Difficulty sanity** | `b` within [−4, +5]; per-arc mean `b` strictly increasing across arcs (warn-only within arc); every probe's `b` within its skill's `b_s ± 1.0` *(absorbs V-B-1)* |
| V-15 | **Id hygiene + round-trip** | all spine ids (arcs/units/skills/grammar nodes/recipes/checkpoints/rare cards) match `^[a-z0-9][a-z0-9._-]*$`; **unit-id grammar**: `^<target>\.(a0\|a1\|a2\|b1\|b2\|c1\|c2)\.u\d{2}$` with `<target>` the underscore-canonical target subtag (`a0` = Launchpad; e.g. `en.a1.u07`), arc ids `<target>.arc<N>`; course_id underscore-canonical; **every `items.id` round-trips through the ONE contract helper: `itemRefKey(parseItemRef(id)) === id`** (R2 cross-spec test) *(absorbs V-ID-1, V-ORD-1)* |
| V-16 | **Overlay referents** | every `l1_overlays.ref_id` exists in its `ref_kind` table; `cognate_credit.payload_json.items[]` all exist in `items`; every `auto` l1 slot resolvable for every SHIPPED overlay language (v0.1: es); pinned overlay keys exist *(absorbs V-L1-1)* |
| V-17 | **Immutability diff** (upgrade builds) | if a previous version's zip is present in `dist/` or S3: no `items.id` removed, no `(kind,source,ref_id)` re-pointed to a different id, no `intro_order` collisions — violations require a MAJOR bump (§8) which the publisher cross-checks |
| V-18 | **Meta coherence** | `manifest.version` == `pack_meta.content_version`; `PRAGMA user_version` == `pack_meta.schema_version`; counts in `pack_meta` match actual row counts; `pack_meta.string_langs` == the 54-list |
| V-19 | **Rare-card economy** | every `rare_cards.provider` (when set) ∈ the V-9 provider registry; `etymology` cards' `item_id` kind = `word`; **v0.1: zero `card_type='story'` rows (R11 — storyChapter is schema-only until the v0.2 coverage workstream); from v0.2, story cards require `coverage_gate ≥ 0.9`** |
| V-20 | **Band-fill spill** (W) | warn when band-fill spill > 25% of a unit's word budget *(absorbs V-WORD-1)* |

Authoring's `V-I18N-1` (app-locale minting of course copy) is **deleted per R1** —
course copy ships in the pack `strings` table and is covered by V-5.

Exit non-zero on any error; `--json` emits a machine-readable report for the ci-gate.

---

## 7. App-side integration

### 7.1 `corpan-app/src/contentPacks/journeyPackCatalog.ts`

Structural clone of `wordPackCatalog.ts` (same fetch layer, same localization primitives,
same gating shape). Key differences: keyed by **single `targetLang`** (not a pair — L1
overlays are inside the pack), and a **`schemaVersion` compatibility gate**.

```ts
// src/contentPacks/journeyPackCatalog.ts
import { fetchJsonFresh, type FreshnessResult, type Validators } from "./catalogFetch";
import { type LocalizedString, parseLocalizedString, resolveLocalized } from "./localized";

export { type LocalizedString, resolveLocalized };

export const JOURNEY_PACK_CATALOG_FORMAT_VERSION = 1;

/** Course-DB schema versions this app build can read (§8). Additive column
 *  changes do NOT bump this; breaking DDL does. */
export const SUPPORTED_JOURNEY_SCHEMA_VERSIONS = new Set([1]);

export const DEFAULT_JOURNEY_PACK_CATALOG_URL =
    "https://d38iwc9748jekz.cloudfront.net/corpan/journey-packs/index.json";
// Build-time override: VITE_JOURNEY_PACK_CATALOG_URL

export type JourneyPackChannel = "stable" | "preview";

export type JourneyPackCatalogEntry = {
    /** Underscore-canonical, immutable: "journey_en". */
    id: string;
    /** Discriminator; entries with any other kind are dropped by the parser. */
    kind: "journey-course";
    /** The language this course TEACHES. One course per target (D6). */
    targetLang: string;
    name: string;
    nameLocalized?: LocalizedString;
    description?: string;
    descriptionLocalized?: LocalizedString;
    /** Content semver (== manifest.version == pack_meta.content_version). */
    version: string;
    /** Course-DB schema version; gated against SUPPORTED_JOURNEY_SCHEMA_VERSIONS. */
    schemaVersion: number;
    zipUrl: string;
    sha256?: string;
    sizeMb: number;
    unitCount?: number;
    itemCount?: number;
    /** Highest CEFR arc shipped, e.g. "A1" for v0.1. Display only. */
    arcMax?: string;
    minAppVersion?: string;
    channel?: JourneyPackChannel;
};

export type JourneyPackCatalog = {
    version: number;
    generatedAt: string;
    packs: JourneyPackCatalogEntry[];
};

export function parseJourneyPackCatalog(data: unknown): JourneyPackCatalog | null;
export async function fetchJourneyPackCatalogFresh(
    validators?: Validators,
): Promise<FreshnessResult<JourneyPackCatalog>>;
export async function fetchJourneyPackCatalog(): Promise<JourneyPackCatalog | null>;

/** minAppVersion + channel (preview hidden unless devMode) + schemaVersion gate. */
export function visibleJourneyPacks(
    catalog: JourneyPackCatalog,
    appVersion: string,
    devMode: boolean,
): JourneyPackCatalogEntry[];

/** Single resolver for both the Journey hero card and Settings. Exact-code match
 *  first, then base-subtag match ("pt-BR" stack target resolves "journey_pt_br"
 *  then "journey_pt"). */
export function findJourneyPackForTarget(
    packs: JourneyPackCatalogEntry[],
    targetLang: string,
): JourneyPackCatalogEntry | undefined;
```

Parser hard-requirements (silently drop otherwise): `id`, `kind === "journey-course"`,
`targetLang`, `version`, `zipUrl`, and `Number.isInteger(schemaVersion)`.
`visibleJourneyPacks` additionally drops entries whose `schemaVersion` is unsupported —
an old app never sees (let alone downloads) a course it cannot read.

### 7.2 Install / upgrade — `corpan-app/src/util/journeyPack.ts`

Clone of `util/wordPack.ts`, minus its stale hardcoded-langs fallback (the
`WORD_PACK_NATIVE_LANGS` set is a documented wart — catalog is the only resolver here):

```ts
export function packIdForTarget(targetLang: string): string {
    return `journey_${targetLang.toLowerCase().replace(/-/g, "_")}`;
}

export function devDownloadUrlForPack(packId: string): string;
// vite dev: `/packs/journey/${packId}.zip` (underscore filenames, R1 — matches the
// published zip base name)

export async function isJourneyPackInstalled(packId: string): Promise<boolean>;
// content_packs_get_manifest_url probe, same as wordPack.ts:60

export async function installJourneyPack(
    packId: string,
    zipUrl?: string,
    expectedSha256?: string | null,
): Promise<void>;
// content_packs_install_from_url with EXPLICIT packId (never filename-derived)

export type JourneyPackMeta = {
    courseId: string; targetLang: string;
    schemaVersion: number; contentVersion: string;
    unitCount: number; itemCount: number;
};

export async function readJourneyPackMeta(packId: string): Promise<JourneyPackMeta | null>;
// SELECT key, value FROM pack_meta — post-install verification (§7.3 step 4)

export async function queryJourney<T>(
    packId: string, sql: string, params: unknown[], maxRows?: number,
): Promise<T[]>;
// thin content_packs_query_db wrapper used by the engine's PackReader
```

### 7.3 Install/upgrade lifecycle

Registry store `corpan-app/src/store/journeyPacks.ts` — exact `phrasePacks.ts` pattern
(zustand `persist`, `createJSONStorage(() => localStorage)`, `partialize`, `version: 1`,
name **`corpan-journey-packs-v1`**):

```ts
export type InstalledJourneyPack = {
    id: string;               // "journey_en"
    targetLang: string;
    version: string;          // content semver installed
    schemaVersion: number;
    name: string;
    nameLocalized?: LocalizedString;
    unitCount: number;
    itemCount: number;
    installedAt: string;      // ISO8601
    sizeBytes: number;
    source: "catalog" | "manual";
};
// state: installed: Record<string, InstalledJourneyPack>
// actions: register / unregister / replaceAll / list / get   (verbatim phrasePacks.ts)
```

**Install** (triggered from the Journey hero card / onboarding journey nodes, D7):

1. `fetchJourneyPackCatalogFresh()` → `visibleJourneyPacks(appVersion, devMode)` →
   `findJourneyPackForTarget(stack.target)`. No entry → hero card hidden (no dead-end UI).
2. `installJourneyPack(entry.id, entry.zipUrl, entry.sha256)`.
3. `readJourneyPackMeta(entry.id)`; verify `schemaVersion` supported and
   `contentVersion === entry.version` — mismatch → uninstall + surface error (a corrupt
   or stale-CDN pack must not seed engine state).
4. `useJourneyPacksStore.register(...)`.

**Upgrade** (checked on catalog refresh, and on Journey surface entry at most 1×/day):

1. `installed.version < entry.version` (semver compare, `wordPackCatalog.ts:219` helper)
   AND `entry.schemaVersion` supported → show a non-blocking "Course update" chip on the
   Journey surface; MAJOR content bumps (§8) show a confirm sheet instead (they may
   orphan items).
2. Re-run install steps 2–4 (installer overwrites `app_data_dir/corpan-packs/<id>/` in
   place; the connection cache in `pack_db.rs` is keyed per (pack, db) — the Journey
   surface must be remounted after upgrade, which the chip flow guarantees).
3. Learner state is untouched: FSRS cards key on `items.id`, which minor/patch upgrades
   never remove (V-17). Cards for items absent from the new DB are retained but
   unschedulable (harmless orphans; a future vacuum can prune them).

**Channel gating**: v0.1 ships `channel: "preview"` — visible only with devMode ON, per
the trunk-streaming rules. Promotion to stable = index-entry edit (publisher flag), no
app change. Journey quota (D9) is orthogonal: it meters feed cards, not installs.

### 7.4 What is NOT in the pack (boundary)

- **Exercise chrome / UI strings** ("Check", "Correct!", placement copy) → app i18n
  (`public/locales/*/common.json`, ×54 build gate). Pack `strings` carry COURSE copy
  only: arc/unit/skill titles, can-dos, grammar notes, overlay notes, recipe titles.
- **Learner state** → IndexedDB LARGE tier (D5). The pack is read-only.
- **Phrase/word/segment CONTENT** (text, translations, audio) → stays in the base corpus,
  phrase packs, wordpan, narration packs. Journey stores only refs; renderers resolve
  content through the existing samplers/readers. A missing referenced phrase pack is a
  render-time JIT-install prompt (wordpan Phrase Flip precedent), never a copy.

---

## 8. Versioning policy

Two independent version axes, both visible in the index:

**`schemaVersion`** (int; `PRAGMA user_version` + `pack_meta.schema_version` + index):
- Bumps ONLY on breaking DDL/semantics changes (column removal/retype, taxonomy meaning
  change, ItemRef serialization change).
- Additive, NULL-able columns and new tables do NOT bump it (the app must `SELECT` by
  column name, never `SELECT *` positionally).
- App declares `SUPPORTED_JOURNEY_SCHEMA_VERSIONS`; catalog filtering makes old
  app × new pack impossible, and new app keeps reading old schemas until support is
  deliberately dropped.

**`version`** (content semver; manifest + pack_meta + index + zip filename):

| Bump | When | Learner-state impact |
|---|---|---|
| **patch** | copy fixes, `b`/`importance`/params tuning, string translations, overlay edits. No id added or removed. | none |
| **minor** | additive content: new units/arcs, new items/skills/edges/overlays/rare cards, new overlay L1s. Existing ids untouched (V-17 enforced). | none — new items appear on the path ahead |
| **major** | any `items.id` removal/renaming, unit renumbering that reorders `intro_order` semantics, or a `schemaVersion` bump. | possible orphaned FSRS cards / path position remap — app shows a confirm sheet and runs a migration hook in `journey/engine/migrations.ts` keyed by (fromMajor, toMajor) |

Invariants:
- **Zips are immutable**: `journey_<target>-<version>.zip`, never overwritten (publisher
  step 3 enforces). Any fix = version bump. Index is the only mutable object.
- Narration-style version-collision discipline applies: same version + different content
  is a publish error, full stop.
- `pack_meta.content_version`, `manifest.version`, index `version` must be equal (V-18).

---

## 9. Size budget — `journey_en` v0.1 (Launchpad + Arc 1, ~30 units)

Assumptions: 2 Launchpad + 20 A1 units authored per the spine, padded to ~30 with the
extra A1 units D11 anticipates; ~50 new lexical items/unit; grammar graph A1 slice ≈ 80
nodes; overlays for **es only** at v0.1 (D10 #5); strings ×54 for all spine copy.

| Table | Rows | Avg bytes/row | Subtotal |
|---|---|---|---|
| items (~1,500 words + ~2,400 phrases + 80 grammarNode + ~20 phoneme) | ~4,000 | ~110 | 0.44 MB |
| item_skills | ~6,000 | ~60 | 0.36 MB |
| strings — spine copy: (30 themes + ~60 can-dos + 90 skill titles + 80 gn titles + 80 gn notes @ ~350 ch + 8 recipe titles + 7 arc titles + misc ≈ 380 keys) × 54 langs | ~20,500 | ~130 (notes pull the mean up) | 2.7 MB |
| strings — es overlay notes (`ovl.es.*` × (es, en)) | ~160 | ~650 | 0.10 MB |
| l1_overlays (80 contrastive + 1 course cognate-credit payload ~2,000 ids + ~20 phoneme pairs) | ~101 | — | 0.08 MB |
| skills / skill_edges / grammar_nodes / units / arcs / lessons / recipes / checkpoints / rare_cards (~600 gems) | ~1,300 | — | 0.15 MB |
| indexes + SQLite page overhead (~35%) | | | 1.4 MB |
| **course.sqlite3 total** | | | **≈ 5.2 MB** |
| **ZIP (deflate; multilingual UTF-8 text ≈ 45–55%)** | | | **≈ 2.4–2.9 MB** |

Calibration anchor: wordpan es pair = 23,514 ~50-word paragraphs → 9.6 MB sqlite →
3.06 MB zip. Our strings volume is ~¼ of that; the structural tables add the rest.

**Budget ceilings (build gate, warn at 80%): 8 MB sqlite / 4 MB zip** for v0.1. Full-course
projection (192 units, ~300 gn, 54 L1 overlay sets): strings scale ~×6 and overlays ~×54
→ ~60–80 MB sqlite, which is why overlays for long-tail L1s may later split into overlay
side-packs — **schema already supports it** (l1_overlays is self-contained per l1), no
decision needed now.

---

## 10. v0.1 build order (implementation checklist)

1. `dja/journey_pack/` skeleton: schemas (pydantic), `recipes.yaml`, DDL module,
   `build_journey_pack.py`, `validate_journey_pack.py`, `publish_journey_pack.py`.
2. **Gap phrase packs (build-order PREREQUISITE, R13)**: build + publish
   `phrase-people-nationalities` and `phrase-life-time-and-dates` via the existing
   `tools/phrase-packs` pipeline BEFORE the pack build — units on the u02–u24 path
   reference them and gates V-1/V-10 fail without them. Shopping/home units re-pool to
   the base corpus where the census supports it, or defer to v0.2.
3. `courses/en/`: course.yaml, grammar.yaml (A1 slice, ~80 nodes, LLM-drafted →
   spot-checked), 30 unit YAMLs (curriculum-spine Part 3 is the content; v0.1 anchors
   only from the R13 set — gate V-9), overlays/es.yaml,
   strings/en.json → agent fan-out to 54.
4. Build + validate + publish `journey_en` 0.1.0, `channel: preview`.
5. App: `contentPacks/journeyPackCatalog.ts`, `util/journeyPack.ts`,
   `store/journeyPacks.ts` (ItemRef helper is the contract's — activity-contract.md §1,
   R2 — nothing new minted here); wire the Journey surface's PackReader to the §2.1
   normative loader (keyset pagination + row-count assertion).
6. Changelog entries: `dja/journey_pack/courses/en/CHANGELOG.md` (new unit) +
   `corpan-app/CHANGELOG.md` (catalog module).

---

## Appendix A — decisions made where D6/D10 were silent (flagged)

1. **`item_skills` join table added** — not in the D6 content list, but D4's derived
   mastery (`I(s)`, items counted in each skill) requires the mapping; a single
   `items.skill_id` column cannot express multi-skill membership.
2. **`unit_lessons` table added** — the unit YAML's `lessons:` list needs a relational
   home; bosses are excluded from it and live solely in `checkpoints` (one per unit,
   engine appends after the last lesson).
3. **Builder is a standalone script, not Django models** — follows the word_pack/hanzi_pack
   precedent and the translations-are-source-code rule; authored YAML/JSON in git is the
   editorial source of truth, `manage.py`/admin is not in the loop.
4. **Grammar nodes attach to exactly one skill** (`grammar_nodes.skill_id`); the DAG is
   expressed only at skill level. Finer prerequisite structure inside a skill is carried
   by `node_order`.
5. **Strings-×54 gate applies to spine copy only; overlay strings need (l1, en) only** —
   full 54×54 overlay copy is explicitly out of v0.1 scope (D10 #5 starts with es→en).
6. **Exercise-chrome UI strings stay in app i18n**, pack strings are course content copy —
   D6 "instruction/note strings ride the existing translation machinery" was read as:
   course-note copy uses the same agent-translation *workflow*, but ships in the pack.
7. **`schemaVersion` surfaced in index.json** (not only inside the DB) so incompatible
   packs are filtered before download.
8. **Index `kind` string is `"journey-course"`**; ZIP filenames are the underscore
   pack id + version suffix (`journey_en-0.1.0.zip`, R1 installer rule); explicit
   packId always passed to the installer (wordpan bug-avoidance).
9. **Phoneme items are course-minted with `unit_id` = the introducing phonology unit**;
   their L1-conditioned drill selection comes from `l1_overlays.phoneme_pair`, so the item
   exists once per contrast, not per L1.
10. **`segment:` refs must be resolvable at build time or the build fails** (V-1) — no
    speculative book references ship; v0.1 uses none unless the book pack dir is present
    on the build machine.

---

## Tracked risks (panel round 1)

Preserved verbatim from the mobile-offline lens of design review round 1 (R16).
Non-blocking; they inform build-time tests, none gate the build start. Gate numbers in
the risk text predate the R1 renumber ("V-4" there is now V-5 in §6.4).

- "i18n gate blast radius: ~110 new app keys ×54 locales are required by the hard
  check:i18n build gate, but feed-ux §10 claims every slice 1–7 'lands green through
  check:i18n' while deferring fan-out to slice 8 — impossible as written; each slice
  must carry its own keys' 54 translations. Separately, course-pack gate V-4 blocks
  journey_en 0.1.0 publish on ~20,500 pack strings (incl. 80 grammar notes ×54, ~350
  chars each) — a large agent-translation and QA effort with no named review step for
  grammar-note correctness in 53 non-EN languages."
- "Most authored unit anchors reference providers that are NOT instrumented in v1
  (juice_squeeze ×3, beatlounge ×2, hover_runner, stargate, tutomaton ×3 in authoring
  §6) — only lingo_hero/earthgate/corpan_city ship the seam (D11). Fallbacks are
  mandatory so the feed degrades, but as authored the anchor economy will mostly never
  fire in v0.1; either re-anchor the A1 units to the three instrumented providers or
  accept that anchors are aspirational this release." *(Ruled forward by R13 + gate
  V-9: v0.1 units re-anchor to the instrumented set; the others are v0.2 pack-data
  swaps.)*
