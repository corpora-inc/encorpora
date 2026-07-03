# Journey — Curriculum Authoring Spec (`journey_en` v0.1)

**Status: v0.1 spec, implements ARCHITECTURE D6/D10/D11. Owner: curriculum authoring workstream.**
**Inputs:** `research/curriculum-spine.md` (spine + first-20-units draft), `research/pedagogy.md`
(§5 frequency, §6 grammar graph, §12 numeric rules), `research/adaptivity.md` (θ/`b`/probe
contract), `codebase/content-data.md` (corpus census, wordpan precedent, §6 new-pack-kind path).
**All corpus numbers in this document were re-verified against `dja/release.sqlite3` and the 34
phrase-pack `phrases.json` sources on 2026-07-03.**

This document specifies, for a senior engineer, everything needed to author, build, lint, and
ship the `journey_en` v0.1 course pack: the authored file formats, the compiled SQLite schema,
the EN grammar-node graph (Launchpad + A1 authored in full), the item-assignment pipeline, the
30-unit outline, validation/calibration, and the es→en overlay v0.1.

Scope boundaries: the runtime engine (FSRS, θ, mixer) is D4 and specified in
`research/adaptivity.md`; the feed UX is D7; the app-side pack loader clones the wordpan module
(`content-data.md` §6). This spec covers only what is *authored and built* on the Spark in
`dja/journey_pack/`.

---

## 0. Repository layout (new, in-repo from day one)

```
corpan/dja/journey_pack/                  # sibling of word_pack/, hanzi_pack/
├── README.md
├── build_journey_pack.py                 # authored YAML → journey_en SQLite → zip
├── lint_journey_pack.py                  # §7 lint rules; exit non-zero on any ERROR
├── assign_items.py                       # §5 item pipeline (wordfreq + census + assignment)
├── calibration_report.py                 # §7.3 predicted-vs-actual (reads local sim / opt-in logs)
├── publish_journey_pack.py               # accumulate-merge index.json, per content-data.md §6
├── requirements.txt                      # wordfreq (MIT), pyyaml, jsonschema
└── courses/en/
    ├── course.yaml                       # course-level metadata + arc table
    ├── grammar/
    │   ├── nodes.yaml                    # full node inventory (v0.1: Launchpad+A1 authored, rest stubs)
    │   └── edges.yaml                    # prerequisite DAG (may also inline in nodes.yaml)
    ├── units/
    │   ├── 000-launchpad-sounds.yaml     # one file per unit, NNN = intro order
    │   ├── 001-launchpad-survival.yaml
    │   ├── 010-hello.yaml
    │   └── ...
    ├── recipes.yaml                      # named lesson recipes (slot lists)
    ├── items/
    │   ├── pins.yaml                     # hand-pinned ItemRefs per unit (overrides)
    │   └── assignments.generated.json    # OUTPUT of assign_items.py (checked in, reviewed in PR)
    └── overlays/
        ├── es.yaml                       # es→en overlay v0.1 (§8)
        └── _schema.yaml
```

Conventions carried over from the fleet:
- Authored YAML is source code, checked into git (same policy as `segments_<lang>.json`).
- Generated `assignments.generated.json` is ALSO checked in — assignment is reviewed, not
  opaque (translations-are-source-code discipline applied to curriculum).
- Pack id is underscore-canonical: **`journey_en`** (installer id derivation rule,
  `content-data.md` §6.2). Zip name `journey_en-<version>.zip`, immutable.
- Ships to `s3://corpan-prod/artifacts/corpan/journey-packs/` + own `index.json`
  (accumulate-merge, `max-age=300`), `channel: "preview"` first. Zero Rust changes.
- YAML gotcha: quote `"no"` anywhere Norwegian appears as a key.

---

## 1. Authored unit file format

One YAML file per unit under `courses/en/units/NNN-slug.yaml`. `NNN` is the course-wide intro
order (gaps allowed; lint enforces monotonicity with `ord`).

### 1.1 Schema (documented as commented YAML; JSON-Schema mirror lives at `courses/_schema/unit.schema.json`)

```yaml
unit:
  id: en.a1.u01            # REQUIRED. "<course>.<arc-tag>.uNN". Immutable once shipped.
  arc: 1                   # REQUIRED. 0=Launchpad, 1=A1, ... 6=Summit.
  ord: 10                  # REQUIRED. Course-wide position (matches filename NNN).
  title: "Hello!"          # REQUIRED. EN display title. i18n key minted as journey.unit.<id>.title
  theme: greetings         # REQUIRED. Free-form editorial theme tag (lint: kebab-case).
  kind: teach              # teach | consolidate | gate  (default teach)

  cando:                   # REQUIRED for teach units. PARAPHRASE-ONLY (CEFR licensing parked —
                           # ARCHITECTURE "Open decisions"). Internal ids, our own wording.
                           # NO Council-of-Europe descriptor ids or verbatim text ships in the pack.
    - id: jcd.a1.intro-self
      text: "Introduce yourself and say who you are"
    - id: jcd.a1.greet
      text: "Greet people and respond to greetings"

  grammar:                 # node ids from grammar/nodes.yaml
    introduce: [en.g.pron-subject, en.g.be-1sg-2sg, en.g.sv-order]
    review: []             # nodes deliberately recycled here (lint: must be introduced earlier)

  vocab_band:              # frequency ranks against wordfreq 'en' large list (§5.1)
    ranks: [1, 60]         # new-vocab budget draws ONLY from this band (+ pins)
    new_target: 24         # intended new lexical items (words+phrases) introduced by this unit

  pools:                   # declarative item-pool selectors resolved by assign_items.py (§5.3).
                           # Sources: "base" (release.sqlite3) or a phrase-pack id.
    - source: base
      domains: [everyday, social]
      levels: [A0, A1]
      text_any: ["hello", "hi ", "good morning", "good afternoon", "good evening",
                 "my name", "nice to meet", "how are you", "goodbye", "see you",
                 "thank", "please", "excuse me", "sorry", "welcome"]
      # census 2026-07-03: this selector matches 97 base-corpus entries at A0/A1 (§7.2)
    - source: base
      domains: [everyday]
      levels: [A0]
      max_word_rank: 200   # any A0 everyday phrase whose every content word is rank ≤ 200

  pins:                    # optional hard includes/excludes (ItemRefs) — trumps pools
    include:
      - {kind: phrase, source: base, id: 27293}   # "Hello"
      - {kind: phrase, source: base, id: 27320}   # "Thank you"
    exclude: []

  words:                   # wordpan word items taught here (surface forms, lang en).
    mode: band             # band = auto-fill from vocab_band ∩ wordpan universe (§5.4)
    pins: [hello, name, please, thanks, goodbye, morning, meet, welcome]

  recipe_mix:              # ordered lesson list; names from recipes.yaml
    - core
    - core
    - phonology            # L1-conditioned: renderer resolves via overlay phoneme table
    - core
    - dialog
    - review
    - core
    - boss

  anchor:                  # the unit's fluency centerpiece (D8: pack activities are anchor cards)
    provider: juice_squeeze          # pack id (underscore-canonical) or native renderer id
    activityType: game-round
    params: {itemset: unit}          # engine materializes itemRefs = this unit's items
    fallback: {provider: native, activityType: match}   # REQUIRED: feed must degrade if pack absent

  boss:                    # every teach unit ends in a task-boss (pedagogy charter #11)
    recipe: boss
    scenario: "Meet three people: greet, exchange names, say goodbye."
    pass_score: 0.8
    must_include: [speak-after-me, listen-pick]   # lint rule V-BOSS-1
    remedial:              # on fail: prescribed remediation before rematch
      max_lessons: 2
      target: weakest      # weakest = lowest-mastery grammar nodes / item clusters of this unit

  l1_slots:                # per-native-language overlay hooks, resolved at render time from
                           # overlay tables keyed (l1, key). Data, not forks (D6).
    contrastive_note: auto     # auto = pull overlay notes for this unit's `grammar.introduce`
    cognate_pass: auto         # auto = run cognate credit rules over this unit's new words
    phonology_focus: auto      # auto = top-priority phoneme contrast for (l1) not yet mastered
    # any slot may instead pin an explicit overlay key: contrastive_note: es.note.pro-drop

  rare_cards:              # optional per-unit additions to the rare-card tables (D7 economy)
    etym_gems: band        # band = wordpan paragraphs for this unit's words
    story: null            # story chapters gate on measured coverage, not unit — usually null

  notes: |
    Authoring rationale, gap references, anything the next author needs.
```

### 1.2 Field semantics and contracts

- **`id` is immutable** once any version of the pack has shipped (FSRS/skill state keys by it).
  Retiring a unit = `kind: teach` → tombstone via `deprecated: true`, never deletion.
- **`cando`** — paraphrase-only. A private crosswalk (`courses/en/cando-crosswalk.private.md`,
  git-ignored) may map `jcd.*` ids to CEFR Companion Volume scales for authoring reference; it
  never ships and its text never gets copied into `text`.
- **`vocab_band.ranks`** are wordfreq ranks (§5.1). Bands across teach units in an arc must be
  contiguous and non-overlapping (lint V-BAND-1); review/gate units carry `ranks: null`.
- **`pools`** are declarative so re-running `assign_items.py` after corpus growth re-resolves
  them; results are frozen into `assignments.generated.json` at build time.
- **`recipe_mix`** length 6–14 for teach units (spine §2.4 envelope scaled down for v0.1 —
  see §6 note on unit sizing).
- **`anchor.fallback` is mandatory** — the feed must not dead-end when the anchor pack is not
  installed (adaptivity §5 "installed-experience registry").

### 1.3 Full worked example — Unit 1 "Hello!" (`courses/en/units/010-hello.yaml`)

Corpus-verified: the greeting selector below matches **97 A0/A1 base-corpus entries** (query in
§7.2). The spine draft mapped Unit 1 to `phrase-learning` — that is wrong: `phrase-learning` is
a *learning-and-curiosity* topic pack (census: 3 of 807 entries are greeting-shaped). Unit 1
draws from the base corpus instead. Correction noted for `research/curriculum-spine.md`.

```yaml
unit:
  id: en.a1.u01
  arc: 1
  ord: 10
  title: "Hello!"
  theme: greetings
  kind: teach

  cando:
    - id: jcd.a1.greet
      text: "Greet people and respond to greetings"
    - id: jcd.a1.intro-self
      text: "Introduce yourself: name, and a simple 'I am...' sentence"
    - id: jcd.a1.leave-take
      text: "Say goodbye politely"

  grammar:
    introduce: [en.g.sv-order, en.g.pron-subject, en.g.be-1sg-2sg]
    review: []

  vocab_band:
    ranks: [1, 60]
    new_target: 24

  pools:
    - source: base
      domains: [everyday, social]
      levels: [A0, A1]
      text_any: ["hello", "hi ", "good morning", "good afternoon", "good evening",
                 "my name", "nice to meet", "how are you", "goodbye", "see you",
                 "thank", "please", "excuse me", "sorry", "welcome"]

  pins:
    include:
      - {kind: phrase, source: base, id: 27293}   # "Hello" (A0)
      - {kind: phrase, source: base, id: 27300}   # "Good morning" (A0)
      - {kind: phrase, source: base, id: 27320}   # "Thank you" (A0)
      - {kind: phrase, source: base, id: 27321}   # "Thank you very much" (A0)
      - {kind: phrase, source: base, id: 3113}    # "My name is John." (A1)
      - {kind: phrase, source: base, id: 11437}   # "My name is Anna." (A1)
      - {kind: phrase, source: base, id: 21687}   # "How are you?" (A1)
      - {kind: phrase, source: base, id: 22513}   # "Nice to meet you." (A1)
    exclude: []

  words:
    mode: band
    pins: [hello, name, please, thanks, goodbye, morning, meet, welcome, fine, you]

  recipe_mix: [core, core, phonology, core, dialog, review, boss]

  anchor:
    provider: juice_squeeze
    activityType: game-round
    params: {itemset: unit}
    fallback: {provider: native, activityType: match}

  boss:
    recipe: boss
    scenario: "Meet three people: greet each one, exchange names, ask how they are, say goodbye."
    pass_score: 0.8
    must_include: [speak-after-me, listen-pick]
    remedial: {max_lessons: 2, target: weakest}

  l1_slots:
    contrastive_note: auto     # es resolves → es.note.pro-drop (subject pronouns are NOT optional)
    cognate_pass: auto
    phonology_focus: auto      # es resolves → es.ph.h-onset ("hello/hola": EN /h/ is voiced air, not silent)

  rare_cards:
    etym_gems: band            # e.g. wordpan("hello"), wordpan("goodbye" < "God be with ye")
    story: null

  notes: |
    First unit of the course; every learner sees it unless placement skips Arc 1.
    Warm-win rule: first two cards must be listen-pick over pinned A0 items.
    Do NOT use phrase-learning here (it is not a greetings pack — verified 2026-07-03).
```

### 1.4 Recipes file (`courses/en/recipes.yaml`)

Recipes are named ordered slot lists. Slot `type` values are the canonical native
`activityType` ids (D8) plus the four scheduler pseudo-slots. v0.1 canonical set:

```
Native renderers (D8):   picture-choice, listen-pick, listen-type, cloze, word-order,
                         match, cued-recall, speak-after-me, translate-pick, translate-type,
                         read-segment, grammar-note, etym-gem
Scheduler pseudo-slots:  review.due, fluency.anchor, meta.recap, probe
```

```yaml
recipes:
  core:                       # scaled-down v0.1 core lesson (~10 steps ≈ 5 min)
    - {slot: review.due, count: 2}                     # warm-up retrieval, FSRS-due, warm-win
    - {slot: input, types: [listen-pick, picture-choice, read-segment], count: 3, new: true}
    - {slot: practice, types: [cloze, word-order, match, cued-recall], count: 3}
    - {slot: produce, types: [speak-after-me, translate-type], count: 1}
    - {slot: fluency.anchor, count: 0..1}              # only if unit anchor scheduled this lesson
    - {slot: meta.recap, count: 1}
  grammar-focus:
    - {slot: review.due, count: 2}
    - {slot: grammar-note, count: 1}                    # ≤60-second rule card, L1 early (charter #8)
    - {slot: input, types: [listen-pick, read-segment], count: 2, feature: unit-grammar}
    - {slot: practice, types: [cloze, word-order], count: 4, feature: unit-grammar}
    - {slot: produce, types: [translate-type, speak-after-me], count: 1}
    - {slot: meta.recap, count: 1}
  dialog:
    - {slot: review.due, count: 1}
    - {slot: input, types: [listen-pick, listen-type], count: 3, material: dialog}
    - {slot: produce, types: [speak-after-me], count: 2, material: dialog}
    - {slot: meta.recap, count: 1}
  phonology:
    - {slot: input, types: [listen-pick], count: 4, material: minimal-pairs}   # HVPT perception
    - {slot: produce, types: [speak-after-me], count: 2}
    - {slot: meta.recap, count: 1}
  story:
    - {slot: input, types: [read-segment], count: 5, coverage_min: 0.95}
    - {slot: practice, types: [cloze, listen-pick], count: 2, material: story}
    - {slot: meta.recap, count: 1}
  review:
    - {slot: review.due, count: 8}
    - {slot: meta.recap, count: 1}
  boss:
    - {slot: probe, count: 6, mix: unit}                # mixed gauntlet over unit items
    - {slot: produce, types: [speak-after-me], count: 1, required: true}
    - {slot: input, types: [listen-pick], count: 1, required: true}
    - {slot: review.due, count: 2, scope: older}        # spaced sample of pre-unit material
    - {slot: meta.recap, count: 1, celebrate: gate}
  gem:
    - {slot: etym-gem, count: 1}
```

The renderer/mixer interprets recipes; the pack only *ships* them (as JSON in `unit.recipe_json`
and a `recipe` table). Strand accounting (pedagogy §12.1) is the mixer's job, not the recipe's;
recipes just guarantee raw material variety.

---

## 2. Compiled pack schema (SQLite DDL)

`build_journey_pack.py` compiles `courses/en/**` into `data/course.sqlite3` inside the zip.
Read at runtime via the generic `content_packs_query_db` (read-only, parameterized —
`src-tauri/src/lib.rs:1102`). Conventions follow the phrase-pack builder
(`tools/phrase-packs/build_phrase_pack.py::_write_schema`): `WITHOUT ROWID` for join tables,
`application_id = 0x434F5250`, `user_version = 1`.

```sql
CREATE TABLE pack_meta(key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID;
-- schema_version=1, course_id='journey_en', target_lang='en', built_at, builder_git_sha,
-- wordfreq_version, corpus_census_json (the §7.2 numbers frozen at build time)

CREATE TABLE arc(
  id INTEGER PRIMARY KEY,            -- 0..6
  tag TEXT NOT NULL,                 -- 'launchpad','a1',...
  title TEXT NOT NULL,               -- EN; i18n via journey.arc.<tag>.title
  cefr TEXT                          -- 'preA1','A1',... display-only, honest framing
);

CREATE TABLE unit(
  id TEXT PRIMARY KEY,               -- 'en.a1.u01'
  arc INTEGER NOT NULL REFERENCES arc(id),
  ord INTEGER NOT NULL UNIQUE,       -- course-wide intro order
  kind TEXT NOT NULL DEFAULT 'teach',-- teach|consolidate|gate
  title TEXT NOT NULL,
  theme TEXT NOT NULL,
  cando_json TEXT NOT NULL,          -- [{id,text}] paraphrases
  rank_min INTEGER, rank_max INTEGER,
  new_target INTEGER,
  recipe_json TEXT NOT NULL,         -- resolved recipe_mix (names + inline slot lists)
  anchor_json TEXT NOT NULL,         -- {provider, activityType, params, fallback}
  boss_json TEXT NOT NULL,           -- {scenario, pass_score, must_include, remedial}
  deprecated INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE grammar_node(
  id TEXT PRIMARY KEY,               -- 'en.g.pres-simple-3sg'
  name TEXT NOT NULL,
  arc INTEGER NOT NULL,              -- home arc (first introduction)
  brief TEXT NOT NULL,               -- ≤240 chars, the ≤60-second rule-card seed text (EN)
  b REAL NOT NULL,                   -- static logit difficulty (§5.5)
  late_acquired INTEGER NOT NULL DEFAULT 0,  -- charter #8: tracked, recycled, NEVER a gate
  probe_json TEXT NOT NULL           -- [{type, template, answer}] probe item patterns (§4)
);

CREATE TABLE grammar_edge(
  node_id TEXT NOT NULL REFERENCES grammar_node(id),
  prereq_id TEXT NOT NULL REFERENCES grammar_node(id),
  PRIMARY KEY(node_id, prereq_id)
) WITHOUT ROWID;

CREATE TABLE unit_grammar(
  unit_id TEXT NOT NULL REFERENCES unit(id),
  node_id TEXT NOT NULL REFERENCES grammar_node(id),
  role TEXT NOT NULL,                -- 'introduce'|'review'
  PRIMARY KEY(unit_id, node_id)
) WITHOUT ROWID;

CREATE TABLE item(
  item_key TEXT PRIMARY KEY,         -- canonical ItemRef key: '<kind>:<source>:<id>'
                                     --   'phrase:base:27293' | 'phrase:phrase-travel-essentials:41'
                                     --   | 'word:en:hello' | 'grammarNode:journey_en:en.g.be-1sg-2sg'
  kind TEXT NOT NULL,                -- ItemRef.kind (D3)
  source TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  unit_id TEXT REFERENCES unit(id),  -- teaching unit (NULL = review-reservoir only)
  intro_ord INTEGER,                 -- order within unit
  b REAL NOT NULL,                   -- static difficulty (§5.5)
  importance REAL NOT NULL DEFAULT 1.0,  -- mixer weight (pins=1.5, band words=1.0, pool extras=0.7)
  probe INTEGER NOT NULL DEFAULT 0,  -- placement/boss probe eligibility (adaptivity §4.2)
  probe_node TEXT,                   -- grammar node this probe evidences, if any
  freq_rank INTEGER,                 -- wordfreq rank of rarest content word (phrases) / the word
  zipf REAL,                         -- zipf of rarest content word / the word
  tags_json TEXT                     -- ['dialog','minimal-pair-seed',...]
);
CREATE INDEX item_unit ON item(unit_id, intro_ord);
CREATE INDEX item_probe ON item(probe) WHERE probe=1;

CREATE TABLE overlay_note(            -- L1 contrastive notes (D6: keyed (l1, key), one spine)
  l1 TEXT NOT NULL,                   -- 'es'
  key TEXT NOT NULL,                  -- 'es.note.pro-drop'
  node_id TEXT REFERENCES grammar_node(id),   -- attach point (NULL = unit-thematic note)
  unit_id TEXT REFERENCES unit(id),
  ord INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL,                 -- authored in EN; localized copies ride the translation
  body_l1 TEXT,                       -- machinery — shipped pre-translated INTO the L1
  PRIMARY KEY(l1, key)
) WITHOUT ROWID;

CREATE TABLE cognate_rule(
  l1 TEXT NOT NULL,
  rule_id TEXT NOT NULL,              -- 'es.cog.cion-tion'
  pattern TEXT NOT NULL,              -- transform, e.g. 'es:-ción => en:-tion'
  credit TEXT NOT NULL,               -- 'recognize' (seeds priorKnown at recognize maturity)
  examples_json TEXT NOT NULL,        -- [["nación","nation"],...]
  blacklist_json TEXT,                -- false friends excluded from this rule
  PRIMARY KEY(l1, rule_id)
) WITHOUT ROWID;

CREATE TABLE phoneme_contrast(
  l1 TEXT NOT NULL,
  contrast_id TEXT NOT NULL,          -- 'es.ph.i-vs-ih'
  label TEXT NOT NULL,                -- '/iː/ vs /ɪ/'
  priority INTEGER NOT NULL,          -- 1 = drill first
  pairs_json TEXT NOT NULL,           -- [["sheep","ship"],["beat","bit"],...] (minimal pairs)
  note TEXT,
  PRIMARY KEY(l1, contrast_id)
) WITHOUT ROWID;

CREATE TABLE rare_card(               -- D7 reward economy tables
  id TEXT PRIMARY KEY,
  card_type TEXT NOT NULL,            -- 'etym-gem'|'game-round'|'delight'|'story-chapter'
  ratio INTEGER NOT NULL,             -- ~1:N roll
  payload_json TEXT NOT NULL
);
```

`ItemRef` (D3) round-trip: `item_key = kind + ':' + source + ':' + id`; the engine parses it
back into `{kind, source, id}`. Grammar nodes are minted by this pack with
`source = 'journey_en'`.

---

## 3. EN grammar-node graph — inventory strategy (~300 nodes)

### 3.1 Strategy for the full spine

- **Target: ~300 ordered nodes** distributed A1 = 43, A2 ≈ 55, B1 ≈ 65, B2 ≈ 60, C1 ≈ 45,
  C2 ≈ 35 (≈ 303). Arc homes follow the spine's Arc 2–6 grammar lists
  (`curriculum-spine.md` Part 4) — those lists ARE the seed inventory for A2+.
- **Mining sources**: CEFR-anchored pedagogical grammar syllabi (Cambridge-profile-*style*
  level assignments), Pienemann processability ordering for the DAG edges (pedagogy §6).
  **Paraphrase-only**: node names/briefs are our own words; no EGP/CoE text is embedded
  (same licensing posture as can-dos).
- **Drafting pipeline**: LLM-drafted (codex, free/subscription backend — house default for bulk
  text) into `nodes.yaml` stubs per arc → human spot-check pass ordering + prereq edges →
  lint (DAG acyclicity, unit-order consistency). journey-en and journey-es prove the format
  (D10.2); nothing beyond A1 blocks v0.1.
- **Node granularity rule**: a node is the smallest grammar object the engine might want to
  *rewind to independently* (D4: "rewind past simple specifically"). If two phenomena are
  always taught, drilled, and remediated together, they are ONE node.
- **`late_acquired` flag**: nodes like 3rd-person `-s` and article mastery are tracked and
  recycled but never gate progression (pedagogy charter #8).
- **v0.1 ships**: the 43 authored nodes below with full briefs/probes, plus arc-stub rows for
  A2+ (id + name + arc only, `b` provisional, no unit references) so the DAG's forward edges
  have anchors. Stubs are excluded from lint rule V-NODE-2 (must-be-referenced).

### 3.2 Authored inventory — Launchpad + Arc A1 (43 nodes)

Notation: probe patterns use the template micro-DSL shipped in `probe_json`:
`word-order: "tok / tok / ..."` (learner orders tokens), `cloze: "... ___ (hint) ..."`,
`listen-pick: "audio=X; options=[...]"`, `translate-pick: "L1 prompt; options=[...]"`.
Every probe pattern must be renderable by a fast form (no speaking — adaptivity §4.2).
`b` values are logit-scale per adaptivity §2.3 (A1 core ≈ −3 … C2 ≈ +4).

| id (`en.g.`) | name | brief (rule-card seed) | prereqs | b | probe patterns |
|---|---|---|---|---|---|
| `sv-order` | Basic word order | English sentences go Subject–Verb–(Object): "I eat apples." The order carries the meaning. | — | −3.6 | word-order: "I / am / Anna" ; word-order: "you / coffee / like" |
| `pron-subject` | Subject pronouns | I, you, he, she, it, we, they. English almost always needs the subject spoken — you can't drop it. | — | −3.6 | translate-pick: "ella → [she/her/he]" ; cloze: "___ am a teacher. (yo)" |
| `be-1sg-2sg` | be: I am / you are | "am" goes with I; "are" goes with you. "I am Anna. You are my friend." | sv-order, pron-subject | −3.5 | cloze: "I ___ a student." ; cloze: "You ___ very kind." |
| `be-all` | be: full present | am/is/are across all persons: he/she/it is; we/you/they are. | be-1sg-2sg | −3.3 | cloze: "She ___ a doctor." ; cloze: "They ___ from Peru." |
| `be-neg` | be: negation | Add "not" after be: "I am not tired. She isn't here." | be-all | −3.2 | word-order: "not / is / she / here" ; cloze: "We ___ not ready." |
| `be-yesno-q` | Yes/no questions with be | Flip be to the front: "You are tired." → "Are you tired?" | be-all | −3.2 | word-order: "you / are / hungry / ?" ; listen-pick: "audio='Is she your sister?'; options=[question/statement]" |
| `wh-quest-be` | Wh-questions with be | What/where/who/how + be + subject: "Where are you? What is this?" | be-yesno-q | −3.1 | word-order: "where / you / are / from / ?" ; cloze: "___ is your name? (question word)" |
| `articles-a-an` | a / an | "a" before consonant sounds, "an" before vowel sounds: a book, an apple. Use it for one, non-specific thing. | — | −3.3 | cloze: "She is ___ engineer." ; translate-pick |
| `dem-sg` | this / that | "this" = near, "that" = far. "This is my phone. That is your bag." | be-all | −3.2 | picture-choice ; cloze: "___ is my house, over there." |
| `poss-adj` | Possessive adjectives | my, your, his, her, its, our, their — before the noun: "her book". | pron-subject | −3.2 | cloze: "That is ___ car. (he)" ; translate-pick: "su (de ella) → [her/his/your]" |
| `poss-s` | Possessive 's | Add 's to the owner: "Anna's dog", "my brother's car". English puts the owner FIRST. | poss-adj | −3.0 | word-order: "dog / Anna's / is / big" ; cloze: "This is my sister___ room." |
| `plural-reg` | Regular plurals | Add -s (or -es after s/sh/ch/x): one cat → two cats; one box → two boxes. | — | −3.2 | cloze: "three ___ (cat)" ; listen-pick: minimal audio "book/books" |
| `plural-irreg` | Irregular plurals | Some nouns change instead: man→men, woman→women, child→children, person→people, foot→feet. | plural-reg | −2.9 | cloze: "two ___ (child)" ; translate-pick |
| `numbers-1-100` | Numbers 1–100 | Cardinal numbers; the -teen vs -ty trap (thirteen/thirty). | — | −3.3 | listen-pick: "audio='thirty'; options=[13/30/33]" ; match: digits↔words |
| `time-telling` | Telling the time | "It's three o'clock. It's half past two. It's 7:15." Always start with "It's". | numbers-1-100, be-all | −3.0 | translate-pick ; cloze: "___ five o'clock. (time)" |
| `time-prep` | at / on / in (time) | at + clock time (at 5), on + days/dates (on Monday), in + months/years/parts of day (in May, in the morning). | time-telling | −2.9 | cloze: "See you ___ Monday." ; cloze: "The class starts ___ 9." |
| `like-want-noun` | like / want + noun | "I like coffee. I want water." Verb + thing, no extra word. | sv-order | −3.2 | word-order: "I / tea / want" ; translate-pick |
| `would-like` | I'd like (polite) | "I'd like a coffee, please" — the polite way to order or ask. | like-want-noun | −3.0 | cloze: "I'd ___ the soup, please." ; listen-pick |
| `some-any` | some / any | "some" in positives ("I have some money"), "any" in negatives and questions ("Do you have any money?"). | plural-reg | −2.8 | cloze: "Do you have ___ questions?" ; cloze: "There is ___ milk in the fridge." |
| `there-is-are` | there is / there are | To say something exists: "There is a bank. There are two cafes." Match is/are to the number. | be-all, plural-reg | −3.0 | cloze: "___ ___ a pharmacy near here?" ; picture-choice |
| `prep-place` | Prepositions of place | in, on, under, next to, behind, in front of, between. | there-is-are | −3.0 | picture-choice ; cloze: "The keys are ___ the table." |
| `art-the` | the (basic) | "the" = the one we both know: "the station", "the sun", second mention. No "the" for general plurals ("I like dogs"). | articles-a-an | −2.7 (late_acquired) | cloze: "Where is ___ bathroom?" ; translate-pick |
| `pres-simple-base` | Present simple (I/you/we/they) | For habits and facts: "I work at home. They live in Lima." | sv-order, pron-subject | −3.1 | word-order: "we / in Madrid / live" ; cloze: "I ___ (work) every day." |
| `adv-freq` | Adverbs of frequency | always, usually, often, sometimes, never — before the main verb, after be: "I always walk. She is never late." | pres-simple-base | −2.9 | word-order: "always / I / coffee / drink" ; cloze position pick |
| `pres-simple-3sg` | 3rd person -s | With he/she/it, the verb takes -s: "She works. He watches." The most-forgotten letter in English. | pres-simple-base | −2.8 (late_acquired) | cloze: "He ___ (work) in a bank." ; listen-pick: "audio='she works'; options=[work/works]" |
| `do-quest` | Questions with do/does | "Do you like tea? Does she work here?" — do/does starts the question; main verb stays bare. | pres-simple-base, pres-simple-3sg | −2.7 | word-order: "does / where / she / work / ?" ; cloze: "___ you speak English?" |
| `do-neg` | Negatives with don't/doesn't | "I don't know. She doesn't eat meat." — don't/doesn't + bare verb. | do-quest | −2.7 | cloze: "He ___ like fish. (negative)" ; word-order |
| `have-got` | have / has | Possession: "I have two brothers. She has a car." ("have got" recognized receptively.) | pres-simple-3sg | −2.8 | cloze: "She ___ a big family." ; translate-pick |
| `obj-pron` | Object pronouns | me, you, him, her, it, us, them — after the verb: "Call me. I see her." | pron-subject | −2.8 | cloze: "I love ___. (she)" ; translate-pick |
| `can-ability` | can / can't (ability) | "I can swim. He can't drive." — same form for everyone, verb stays bare. | pres-simple-base | −2.8 | cloze: "She ___ speak three languages." ; listen-pick: "audio='I can't come'; options=[can/can't]" |
| `can-request` | can (requests & permission) | "Can I have the menu? Can you help me?" — the everyday polite ask. | can-ability | −2.7 | word-order: "can / the bill / I / have / ?" ; translate-pick |
| `imperatives` | Imperatives | Tell someone what to do with the bare verb: "Turn left. Don't stop. Please wait." | sv-order | −2.9 | word-order: "left / turn / at the bank" ; picture-choice (direction arrows) |
| `how-much-many` | How much / How many | many + countables ("How many apples?"), much + uncountables ("How much water?"); prices: "How much is it?" | some-any, plural-reg | −2.6 | cloze: "How ___ does it cost?" ; cloze: "How ___ people are coming?" |
| `pres-cont` | Present continuous | be + verb-ing for right now: "I am eating. They are working." | be-all, pres-simple-base | −2.6 | cloze: "Look! It ___ ___ (rain)." ; word-order |
| `simple-vs-cont` | Simple vs continuous | Habit vs. right now: "I drink coffee every day" vs "I am drinking coffee (now)". | pres-cont, adv-freq | −2.4 | translate-pick pairs ; cloze with time marker: "She usually ___ tea, but today she ___ coffee." |
| `dummy-it` | it for weather & time | English needs a subject even for weather/time: "It's raining. It's cold. It's late." | pres-cont, time-telling | −2.5 | word-order: "raining / it / is" ; translate-pick: "llueve → [It rains / It's raining / Is raining]" |
| `past-be` | was / were | Past of be: I/he/she/it was; you/we/they were. "I was at home. They were happy." | be-all | −2.5 | cloze: "Where ___ you yesterday?" ; cloze: "The film ___ great." |
| `past-reg` | Past simple: -ed | Add -ed for finished actions: "I worked. She visited her mother." Same form for all persons. | past-be, pres-simple-base | −2.4 | cloze: "We ___ (watch) a film last night." ; listen-pick: /t,d,ɪd/ ending audio |
| `past-irreg-top25` | Irregular past (top 25) | The 25 most common verbs change form: go→went, have→had, see→saw, do→did, get→got, make→made… | past-reg | −2.2 | match: base↔past ; cloze: "She ___ (go) to Rome in May." |
| `past-quest-neg` | did: questions & negatives | "Did you see it? I didn't go." — did carries the past; the main verb goes back to base form. | past-irreg-top25, do-quest | −2.1 | cloze: "___ you ___ (enjoy) the party?" ; word-order |
| `going-to` | going to (plans) | be + going to + verb for plans: "I'm going to visit my aunt tomorrow." | pres-cont | −2.2 | cloze: "We ___ ___ ___ travel in June." ; translate-pick (es "ir a" maps directly) |
| `comp-superl` | Comparatives & superlatives | Short adjectives: -er/-est (older, the oldest); long ones: more/most; irregulars: good→better→best, bad→worse→worst. Compare with "than". | plural-reg | −2.0 | cloze: "My city is ___ (big) than yours." ; cloze: "She is the ___ (good) player." |
| `conn-basic` | and / but / because | Join ideas: "I like tea and coffee. It's small but nice. I'm tired because I worked." | pres-simple-base | −2.3 | cloze pick: "It was raining, ___ we stayed home." ; word-order |

DAG sanity: every prereq is introduced in an earlier-or-same-`ord` unit (lint V-DAG-2). The
Launchpad units introduce no grammar nodes (phoneme contrasts are `phoneme` ItemRefs, not
grammar nodes); `sv-order`/`pron-subject` fire in `en.a1.u01`.

---

## 4. Probe items

Probes serve two consumers: **placement** (adaptivity §4 — fast forms only) and **unit bosses**.

- Per grammar node, the builder materializes **2–4 probe items** from `probe_json` templates,
  instantiated with vocabulary from the node's home-unit band (guarantees a placement probe
  never fails on an unknown WORD when testing a STRUCTURE — lint V-PROBE-2: every content word
  in a probe instance must have zipf ≥ 4.3, i.e. ~top-3k).
- Probe items are rows in `item` with `probe=1`, `probe_node=<node_id>`, `b = node.b`.
- Additionally each ARC gets 5 band-ladder probes at `b ∈ {−3, −1.5, 0, +1.5, +3}` for
  placement Phase 1 (adaptivity §4.3) — chosen by the builder as the highest-frequency,
  least ambiguous probe instances nearest each target `b`.

---

## 5. Item pipeline — corpus → units

### 5.1 Frequency ranks (D10.1)

- **Source: `wordfreq` (MIT, pip)**, `'en'` large list, pinned version recorded in
  `pack_meta.wordfreq_version`. Rank = index in `top_n_list('en', 50000)`; zipf via
  `zipf_frequency(word, 'en')`. Both computed at build time by `assign_items.py`;
  nothing runs on-device.
- Tokenization for phrases: lowercase, `[a-zA-Z']+` tokens, stopword-light — we deliberately do
  NOT lemmatize in v0.1 (wordpan is surface-form keyed too; lemma linkage is a known gap,
  `content-data.md` §8). Contractions split on `'` are looked up whole first (`don't`), then
  parts.
- **Content words** of a phrase = tokens not in the closed-class top-50 function list
  (a, the, is, to, of…, shipped in `assign_items.py` as a constant).

Verified against the real corpus (2026-07-03, wordfreq in a scratch venv):

| Measure | Value |
|---|---|
| wordpan word universe | 11,757 distinct EN surface words |
| — zipf ≥ 5.0 (≈ top 1k) | 1,039 |
| — zipf 4.3–5.0 (≈ 1k–3k) | 2,476 |
| — zipf 3.7–4.3 (≈ 3k–8k) | 3,247 |
| — zipf 3.0–3.7 (≈ 8k–25k) | 2,976 |
| — zipf < 3.0 (> ~25k) | 1,917 |
| — not in wordfreq at all | 102 |
| base-corpus A0 phrases: token coverage by top-1k ranks | 84.5% |
| base A1 | 80.1% |
| base A2 | 77.7% |
| base B1 | 77.1% |
| A1-labeled phrases, rarest-word rank (2k sample) | median ≈ 1,495; p90 ≈ 6,302 |

Two design consequences, both load-bearing:
1. The A1 arc's rank 1–1,000 band has **1,039 wordpan words** available — almost exactly the
   budget (Arc 1 target = 1,000 cumulative ranks, spine §2.2). Band-fill works without new
   word authoring.
2. The A1 CEFR label is a **weak prior exactly as predicted** (p90 phrase contains a
   rank-6.3k word): CEFR alone cannot sequence items; the rank term in `b` (§5.5) and the
   band filter in pool resolution do the real work.

### 5.2 Item universe for `journey_en` v0.1

- **Phrases**: base corpus 10,000 entries (`phrase:base:<id>`) + 34 phrase packs 15,774
  entries (`phrase:<packId>:<entryId>`) = 25,774. All 54 languages present on every entry
  (translation-direction exercises come free — spine §2.7.5).
- **Words**: wordpan universe 11,757 (`word:en:<word>`); etymology paragraphs available in
  44 complete languages.
- **Grammar nodes**: minted here (§3).
- **Phonemes**: minted per overlay (`phoneme:journey_en:<contrast_id>`).
- Book segments (`segment:` kind) are NOT unit-assigned in v0.1 — readers arrive via
  coverage-gated story/anchor cards, selected at runtime by measured coverage
  (pedagogy §2), not authored into units.

### 5.3 Phrase → unit assignment (`assign_items.py`)

Deterministic, greedy, in unit `ord` order:

```
for unit in units_by_ord (kind == 'teach'):
    candidates = union(resolve(pool) for pool in unit.pools)   # SQL against release.sqlite3
                                                               # + phrase-pack phrases.json
    candidates -= already_assigned                             # first unit wins ("teach home")
    candidates = [p for p in candidates
                  if max_rank_of_content_words(p) <= unit.rank_max * 1.2   # 20% slack
                  or all_overrank_words_in(p, unit.words.pins)]            # taught here anyway
    score(p) = 2.0 * pool_priority(p)            # earlier pool in the list = higher
             + 1.0 * level_prior_match(p, unit)  # phrase CEFR level ∈ unit arc's levels
             + 1.0 * grammar_hit(p, unit)        # regex per introduced node (e.g. r"\bdoesn't|\bdoes\b.*\?")
             − 0.5 * length_penalty(p)           # tokens > 12
    assign top-N by score, N = clamp(new_target * 3, 40, 120)  # teach pool ≈ 3× new_target
    pins.include are force-assigned; pins.exclude force-dropped (lint if conflict)
unassigned phrases → review reservoir (unit_id NULL): usable by the mixer for
encounter-injection and translate cards once their rarest word is FSRS-known.
```

Notes:
- `grammar_hit` regexes ship IN `nodes.yaml` per node (optional `match:` field) — cheap,
  transparent, reviewable. No NLP dependency in v0.1.
- Every phrase has exactly one teach home or none. Cross-unit reuse happens at runtime through
  FSRS review, not through duplicate assignment.
- The whole assignment output is diffed in PR review (`assignments.generated.json`).

### 5.4 Word → unit assignment

- `mode: band`: unit gets all wordpan words with rank inside `vocab_band.ranks` that are not
  already pinned elsewhere, capped at `new_target`; overflow spills to the next unit in the
  same arc (lint warns when spill > 25%).
- Words with zipf < 3.0 (1,917 words) and not-in-wordfreq (102) never band-assign in Arcs 0–2;
  they remain reservoir items for B2+ authoring and etym-gem rolls.
- Word items are introduced at **recognize** form first (picture-choice / listen-pick), per the
  modality ladder; the form ratchet is the engine's job.

### 5.5 Static difficulty `b` seeding (adaptivity contract: logit scale, A1 ≈ −3 … C2 ≈ +4)

**Phrases:**

```
anchor(level):  A0 −3.5 · A1 −3.0 · A2 −1.8 · B1 −0.5 · B2 +1.0 · C1 +2.2 · C2 +3.2
freq_adj  = clamp(0.55 × (4.2 − min_zipf_of_content_words), −0.9, +1.4)
len_adj   = clamp(0.06 × (n_tokens − 6), −0.4, +0.6)
b = clamp(anchor(level) + freq_adj + len_adj, −4.0, +4.0)
```

Sanity against real data: the median A1 phrase (rarest word rank ≈ 1.5k → zipf ≈ 4.3) gets
`b ≈ −3.0 − 0.05 ≈ −3.05`; the p90 A1 phrase (rank 6.3k → zipf ≈ 3.75) gets `b ≈ −2.75 + len`.
The spread is intentionally mild — `b` is a prior; θ-Elo and the calibration report (§7.3)
correct it. CEFR labels are 7B-model output (`content-data.md` §8) and are used ONLY through
`anchor(level)`; D10.4 relabeling later just re-runs this function.

**Words** (piecewise-linear on zipf, anchored to the coverage bands):

```
zipf ≥ 6.0 → −3.5 ;  5.0 → −3.0 ;  4.3 → −2.0 ;  3.7 → −0.5 ;  3.0 → +1.0 ;  ≤ 2.0 → +2.5
(linear interpolation between anchor points)
```

**Grammar nodes**: authored per node (§3.2 table). **Probes**: inherit node `b`.
**Phoneme contrasts**: fixed −3.0 (they are drilled from day 1 regardless of θ).

### 5.6 Importance + intro order

- `importance`: pins 1.5, band words and grammar nodes 1.0, pool-extra phrases 0.7 —
  consumed by the mixer's new-item sampler.
- `intro_ord` within a unit: grammar-node probe seeds first, then pinned phrases, then band
  words interleaved with scored phrases (so lesson 1 of a unit always has teachable material).

### 5.7 Gap list → new dja phrase packs (D10.3)

Census-verified gaps in the corpus for the A1 outline (queries in §7.2): nationality
formulas (4 matches), telling-time (26), transactional shopping (25 "How much"-family),
home/furniture (3 furniture matches). Greetings are NOT a gap (97 A0/A1 base entries).
Four small packs, built with the existing `tools/phrase-packs` pipeline (facet model per
`facets.py`, codex authoring, 54-language fan-out, `channel: "preview"`):

| pack id | target size | level mix (A0/A1/A2/B1) | facets (WIDE-style, 3–4 each) | consuming units |
|---|---|---|---|---|
| `phrase-people-nationalities` | 120 | 20/60/30/10 | countries & "I'm from…"; nationality adjectives; languages spoken; "Where are you from?" dialog turns | u02 |
| `phrase-life-time-and-dates` | 160 | 30/70/40/20 | clock time; days & parts of day; dates, months, birthdays; schedules & "What time…?" | u04, u05 |
| `phrase-life-shopping-basics` | 200 | 30/80/60/30 | prices & paying; sizes, colors, trying on; at the market; returns & problems (A2 tail) | u12, u17 |
| `phrase-life-home-and-furniture` | 160 | 30/70/40/20 | rooms; furniture & objects; describing your home; household routines | u24 |

Authoring constraints for all four: every A0/A1 phrase's content words must sit within the
consuming unit's rank band (+20% slack) — this is lint rule V-GAP-1 run against the pack's
`phrases.json` before translation fan-out (cheaper to fix pre-translation). These packs are
ordinary phrase packs (also usable standalone); Journey references them by pack id in `pools`.

---

## 6. Launchpad + Arc A1 — unit-by-unit outline (30 units)

D11 says "~30 authored units"; the research draft sketched 2+20. This spec expands to
**2 Launchpad + 28 A1** by splitting dense draft units (numbers/time, food/eating-out,
past×2 kept, weather and clothes/shopping separated, people-descriptions and free-time added)
and adding one consolidation + one production + one gate unit. Rank bands: 25 teach units cover
ranks 1–1,000 at ~40 ranks/unit (new_target ≈ 24–40 items incl. words). Unit sizing note:
v0.1 units are leaner than the spine's 12–18-lesson envelope (recipe_mix of 6–10) — first-pass
scope control; envelope grows in v0.2 without schema change.

Column key — **G**: grammar `introduce` (ids `en.g.*`); **Pools**: `base:<domains>` at A0/A1
unless noted, `+pack` = phrase pack; **R**: recipe_mix summary; **A**: anchor provider.

| # | id | Title / theme | G | Ranks | Pools | R | A |
|---|---|---|---|---|---|---|---|
| 0 | `en.pre.u01` | The sounds of English (phonology; Latin-script L1s compress to 1 lesson) | — (phoneme items via overlay) | — | minimal-pair seeds tagged in base A0 | phonology ×3, core | native listen-pick (HVPT) |
| 1 | `en.pre.u02` | Survival kit (hello/thanks/yes/no, numbers 1–10, "I don't understand", "more slowly please"; embedded placement probes) | — | 1–30 | base:everyday A0 survival block (ids 27293+) | core ×2, review, boss | juice_squeeze |
| 2 | `en.a1.u01` | **Hello!** (worked example §1.3) | sv-order, pron-subject, be-1sg-2sg | 1–60 | base:everyday,social greeting selector (97 entries) | core×3, phonology, dialog, review, boss | juice_squeeze |
| 3 | `en.a1.u02` | Who are you? (countries & nationalities) | be-all, be-neg, be-yesno-q, wh-quest-be, articles-a-an | 60–100 | +`phrase-people-nationalities`; base:social | core×3, grammar-focus, dialog, boss | lingo_hero |
| 4 | `en.a1.u03` | My people (family) | poss-adj, poss-s, dem-sg | 100–140 | +`phrase-life-family-and-friends` (A0/A1: 128 entries); base:social | core×3, grammar-focus, story, boss | native picture-choice |
| 5 | `en.a1.u04` | Numbers | numbers-1-100, plural-reg | 140–175 | base:numbers (A0+A1: 168) | core×2, grammar-focus, review, boss | beatlounge |
| 6 | `en.a1.u05` | Time & dates | time-telling, time-prep | 175–210 | +`phrase-life-time-and-dates`; base:numbers,everyday | core×3, dialog, boss | beatlounge |
| 7 | `en.a1.u06` | Food & drink | like-want-noun, some-any | 210–250 | +`phrase-life-cooking-basics` (A0/A1: 128); base:everyday | core×3, phonology, boss | juice_squeeze |
| 8 | `en.a1.u07` | Eating out | would-like | 250–285 | +`phrase-travel-essentials` (A0/A1: 80); base:travel | core×2, dialog×2, boss | corpan_city |
| 9 | `en.a1.u08` | My town | there-is-are, prep-place, art-the | 285–330 | +`phrase-places-geography-world` (A0/A1: 128); base:housing,travel | core×3, grammar-focus, boss | corpan_city |
| 10 | `en.a1.u09` | Every day (routines) | pres-simple-base, adv-freq | 330–380 | base:everyday A1 | core×3, grammar-focus, story, boss | hover_runner |
| 11 | `en.a1.u10` | She works (jobs) | pres-simple-3sg, do-quest, do-neg | 380–425 | +`phrase-work-office-basics` (A0/A1: 80); base:business | core×3, grammar-focus×2, boss | lingo_hero |
| 12 | `en.a1.u11` | My stuff (possessions) | have-got, plural-irreg, dem-pl* | 425–465 | +`phrase-tech-computers-basics` objects subset; base:everyday | core×3, review, boss | native picture-choice |
| 13 | `en.a1.u12` | Colors & clothes | (review: poss-adj, dem-sg) | 465–500 | +`phrase-life-shopping-basics` (clothes facet); base:everyday | core×3, phonology, boss | native match |
| 14 | `en.a1.u13` | Can you? — **Mini-gate** | can-ability, can-request | 500–535 | base:everyday,social | core×2, grammar-focus, **boss+ = cumulative gauntlet u01–u13** | boss-only |
| 15 | `en.a1.u14` | Right now | pres-cont, simple-vs-cont | 535–575 | base:everyday; +`phrase-life-the-night` scene subset (A0/A1: 80) | core×3, grammar-focus, story, boss | stargate reader (scene descriptions) |
| 16 | `en.a1.u15` | Weather & seasons | dummy-it | 575–610 | base:environment (A0/A1: 125); +`phrase-nature-birds-everyday` sky subset | core×2, dialog, review, boss | native picture-choice |
| 17 | `en.a1.u16` | Getting around | imperatives | 610–650 | +`phrase-travel-essentials`; +`phrase-vehicles-cars-and-driving` (A0/A1: 80); base:travel | core×3, dialog, boss | corpan_city |
| 18 | `en.a1.u17` | Shopping & money | how-much-many | 650–690 | +`phrase-life-shopping-basics`; base:everyday | core×2, dialog×2 (shop role-play), boss | dialog boss w/ tutomaton-scripted fallback |
| 19 | `en.a1.u18` | People & descriptions | obj-pron | 690–725 | base:social A1 | core×3, grammar-focus, boss | native cued-recall |
| 20 | `en.a1.u19` | Free time & hobbies | (review: like-want-noun, adv-freq; like+-ing receptive) | 725–765 | +`phrase-sports-soccer-basics` (A0/A1: 79); +`phrase-arts-music-fundamentals` (A0/A1: 128) | core×3, story, boss | lingo_hero |
| 21 | `en.a1.u20` | Yesterday | past-be, past-reg | 765–810 | +`phrase-life-festivals-world` events (A0/A1: 127); base:everyday | core×3, grammar-focus×2, boss | native listen-type |
| 22 | `en.a1.u21` | Went, saw, did | past-irreg-top25, past-quest-neg | 810–855 | base:everyday,social; graded narration micro-stories (runtime, coverage-gated) | core×3, grammar-focus, story×2, boss | earthgate reader |
| 23 | `en.a1.u22` | Plans & invitations | going-to | 855–895 | +`phrase-life-family-and-friends`; base:social | core×3, dialog×2, boss | tutomaton (scripted chat)* fallback native dialog |
| 24 | `en.a1.u23` | Feeling good, feeling bad | (lexical: feel/hurt, should-advice receptive) | 895–930 | +`phrase-life-health-and-body` (A0/A1: 128); base:health (A0/A1: 243) | core×3, phonology, boss | native speak-after-me focus |
| 25 | `en.a1.u24` | House & home | (review: there-is-are, prep-place; whose/mine receptive) | 930–965 | +`phrase-life-home-and-furniture`; base:housing (A0/A1: 174) | core×3, review, boss | native picture-choice |
| 26 | `en.a1.u25` | Better, best | comp-superl | 965–1000 | +`phrase-sports-soccer-basics` comparison-rich; base:social | core×3, grammar-focus, boss | lingo_hero |
| 27 | `en.a1.u26` | The story so far (consolidation, `kind: consolidate`) | conn-basic; review: all weak nodes | — | pure FSRS harvest + reservoir | review×4, story, gem | native |
| 28 | `en.a1.u27` | My story (integrative production) | (review: conn-basic + past + present) | — | learner-relevant reservoir sample | core, dialog, produce-heavy core×2, boss (3-sentence spoken+written self-narrative) | tutomaton* fallback speak-after-me |
| 29 | `en.a1.u28` | **Arc gate: A1 exam** (`kind: gate`) | — | — | probe items across all 43 nodes + can-do checklist | gate recipe (adaptive, placement-grade) | native probes + speak rubric |

*dem-pl (these/those) rides as a minor extension of `dem-sg` inside u11 — not a separate node.
*tutomaton anchors are scripted-mode only in v0.1 (tutomaton grading is out of scope, D11);
fallback is mandatory.

Pool-size numbers cited (e.g. "A0/A1: 128" for family-and-friends) are the real per-pack
A0+A1 counts from the 2026-07-03 census (§7.2 table): DEEP packs have 128 A0+A1 entries,
WIDE packs 80, professional packs 8–15. Every teach unit above clears the V-POOL-1 floor
(≥ 40 teach candidates) except via combination with base-corpus pools — the per-unit
resolved counts are emitted by the build report (§7.2.3).

---

## 7. Validation & calibration

### 7.1 Authoring lint (`lint_journey_pack.py` — ERROR blocks build; WARN prints)

Structural:
- **V-ID-1** (E): unit/node ids match `^en\.(pre|a[12]|b[12]|c[12])\.u\d{2}$` / `^en\.g\.[a-z0-9-]+$`; unique; never removed vs previous shipped version (tombstone only).
- **V-ORD-1** (E): `ord` unique, monotone with filename `NNN`, arcs non-interleaved.
- **V-DAG-1** (E): grammar DAG acyclic.
- **V-DAG-2** (E): every prereq of a node introduced in a unit with `ord` ≤ the node's home unit `ord`.
- **V-NODE-1** (E): every `grammar.introduce`/`review` id exists in `nodes.yaml`.
- **V-NODE-2** (E): every non-stub node is introduced by exactly one unit. (W): stub nodes referenced by units.
- **V-BAND-1** (E): teach-unit rank bands contiguous, non-overlapping, monotone in `ord` within an arc.
- **V-RECIPE-1** (E): every recipe name resolves; teach unit recipe_mix length 6–14 and contains ≥1 `boss`.
- **V-BOSS-1** (E): boss `must_include` ⊇ {speak-after-me, listen-pick}; `pass_score` ∈ [0.7, 0.9].
- **V-ANCHOR-1** (E): anchor provider ∈ known-provider registry; `fallback.provider == native`.
- **V-L1-1** (E): every `auto` l1 slot resolvable for every SHIPPED overlay language (v0.1: es); pinned overlay keys exist.

Content:
- **V-POOL-1** (E): every teach unit's resolved pool ≥ max(40, 2×new_target) phrase candidates; (W) < 3×new_target.
- **V-POOL-2** (E): pinned includes exist in their source and are not excluded elsewhere.
- **V-PROBE-1** (E): every authored node yields ≥2 valid probe instances; probe forms are fast forms only.
- **V-PROBE-2** (E): probe-instance content words all zipf ≥ 4.3.
- **V-GAP-1** (E): gap-pack A0/A1 phrases' content words within consuming unit band × 1.2.
- **V-CANDO-1** (E): every teach unit has ≥1 can-do; (E) can-do `text` contains no 8+-word verbatim substring of the CEFR CV descriptor corpus (checked against a local, non-shipped reference file); paraphrase-only invariant.
- **V-COPY-1** (E): banned-absolutes list ("forever", "never", "100%", "entirely", "always", "guaranteed") in any user-facing string; (E) "flag/flagging" in any user-facing string.
- **V-WORD-1** (W): band-fill spill > 25% of a unit's word budget.
- **V-B-1** (E): all `b` ∈ [−4, +4]; arc-mean `b` monotone increasing across arcs.

i18n:
- **V-I18N-1** (E, at app integration): every minted `journey.*` key present in all 54 locales (`npm run check:i18n` is the existing build gate; unit titles/briefs/can-dos/overlay bodies all mint keys).

### 7.2 Corpus census & per-unit coverage checks

The build embeds the census in `pack_meta.corpus_census_json` and emits
`build/coverage_report.md`. **Baseline real numbers (2026-07-03):**

**7.2.1 Base corpus (`dja/release.sqlite3`) — 10,000 entries, 54 langs × 10,000 translations.**
Level totals: A0 380 · A1 2,500 · A2 2,800 · B1 3,400 · B2 800 · C1 100 · C2 20.
Domain × level (entries; domains overlap):

| domain | A0 | A1 | A2 | B1 | B2 | C1 | C2 |
|---|---|---|---|---|---|---|---|
| everyday | 323 | 1,791 | 1,768 | 1,565 | 302 | 37 | 6 |
| social | 126 | 677 | 929 | 1,296 | 298 | 36 | 8 |
| business | 53 | 135 | 255 | 561 | 164 | 21 | 3 |
| education | 40 | 191 | 294 | 516 | 128 | 15 | 3 |
| culture | 5 | 231 | 243 | 430 | 117 | 17 | 5 |
| travel | 67 | 148 | 369 | 425 | 85 | 5 | 1 |
| health | 34 | 209 | 306 | 310 | 64 | 6 | 0 |
| housing | 25 | 149 | 251 | 231 | 45 | 3 | 0 |
| technology | 14 | 118 | 211 | 270 | 69 | 7 | 1 |
| environment | 8 | 117 | 198 | 244 | 50 | 6 | 1 |
| civic | 5 | 54 | 86 | 194 | 64 | 17 | 2 |
| emergency | 12 | 52 | 100 | 164 | 42 | 11 | 2 |
| numbers | 61 | 107 | 103 | 66 | 21 | 1 | 1 |

**7.2.2 Phrase packs — 34 packs, 15,774 entries.** Level totals: A0 182 · A1 2,311 ·
A2 5,365 · B1 2,842 · B2 2,419 · C1 1,873 · C2 782. Shape: DEPTH packs (807–810 entries)
carry 8 A0 + 120 A1 each; WIDE packs (504–506) carry 5 A0 + 75 A1; the 10
`phrase-professional-*` packs are tiny (56–120) and B-heavy — they are B1+ material, not A1.
**Combined A0+A1 pool for the A1 arc = 2,880 (base) + 2,493 (packs) = 5,373 phrases** against
an Arc-1 teach demand of ≈ 25 units × ~90 pool candidates ≈ 2,250 — comfortable at arc level;
per-unit adequacy is what V-POOL-1 checks (domain intersection is the binding constraint, not
totals).
**Top-end honesty**: C1+C2 = 120 base entries + 2,655 pack entries — Summit-arc authoring will
need net-new content, but that is years away and out of v0.1 scope.

**7.2.3 Gap probes (base corpus, EN `LIKE` scans)** — the numbers that justify §5.7:
time/"o'clock|What time" 26 · "How much" 25 · nationality formulas 4 · furniture terms
(sofa/couch/wardrobe/armchair) 3 · greeting-family at A0/A1 **97** (no gap pack needed for
greetings; `phrase-learning` contains only 3 greeting-shaped entries of 807 — the spine
draft's Unit-1 mapping is corrected in §1.3).

**7.2.4 Per-unit coverage check (build-time, mandatory):** for every teach unit the builder
re-runs the pool resolution and prints: resolved candidate count, assigned count, band-word
count, probe count per introduced node, and the top-5 rarest content words with ranks. Any
V-POOL/V-PROBE failure blocks. The report is committed with the build
(`courses/en/items/assignments.generated.json` + `build/coverage_report.md`) so PR review sees
coverage regressions.

### 7.3 Predicted-vs-actual difficulty calibration (local-only)

Per adaptivity §"static difficulty calibration": author-assigned `b` is noisy by construction.

- **Pre-ship (Spark)**: the engine's simulation harness (D4 "pure TS, simulatable") runs
  synthetic learners (θ swept −4…0) over the built pack; `calibration_report.py` bins items by
  `b` (width 0.5) and reports simulated P(correct) vs `σ(θ−b)` — catches gross mis-seeding
  (e.g. a "−3" unit whose items behave like −1.5) before anything ships.
- **On-device (post-ship)**: the engine already logs `(item_key, b, θ_at_review, outcome)` in
  the review-log ring buffer (D5). A local-only diagnostics screen (devMode) computes per-unit
  mean logit residual `logit(observed) − (θ−b)` and per-item residual for items with ≥30
  observations. **Nothing leaves the device** (philosophy: on-device analytics).
- **Feedback into authoring**: v0.2 of the pack may apply shrinkage
  `b' = b + λ·residual, λ = n/(n+50)` from opt-in exported local reports or from Spark
  simulation only — a data pipeline, not hand-tuning (calibration-is-a-data-pipeline rule).
  `b` changes never rename items, so FSRS state survives pack upgrades.

---

## 8. es→en overlay v0.1 (`courses/en/overlays/es.yaml`)

All entries are LLM-draftable (codex default backend) against this exact list, then
human-spot-checked. Bodies are authored in EN and shipped with `body_l1` pre-translated to
Spanish (agents translate directly, house i18n rule). Attach points reference §3.2 node ids.

### 8.1 Contrastive notes (25)

| key (`es.note.`) | node | gist of the note (1–3 sentences when authored) |
|---|---|---|
| `pro-drop` | pron-subject | Spanish drops subject pronouns ("soy Ana"); English requires them ("I am Ana"), always. |
| `ser-estar-merge` | be-all | ser and estar BOTH become "be" — one verb covers both permanent and temporary. |
| `no-do-support` | do-quest | Spanish questions work by intonation; English inserts do/does. "¿Te gusta el café?" → "Do you like coffee?" |
| `double-negative` | do-neg | "No veo nada" is one negative in English: "I don't see anything" (not "don't see nothing"). |
| `third-person-s` | pres-simple-3sg | Spanish conjugates every person, so the lone English -s feels invisible. It's the #1 A1 error: "she work" ✗. |
| `present-overlap` | simple-vs-cont | Spanish "como" covers both; English splits: "I eat" (habit) vs "I am eating" (now). |
| `gustar-reversal` | like-want-noun | "Me gusta el té" flips: the LIKER is the subject in English — "I like tea." |
| `tener-age` | have-got | Age uses be, not have: "tengo 20 años" → "I AM 20 (years old)". |
| `hay-agreement` | there-is-are | "hay" is invariable; English matches number: there IS a cafe / there ARE two cafes. |
| `article-generic` | art-the | General statements drop "the": "La vida es bella" → "Life is beautiful"; "me gustan los perros" → "I like dogs". |
| `adj-position` | comp-superl (also u12) | Adjectives go BEFORE the noun and never take plural: "los coches rojos" → "the red cars". |
| `possessive-s` | poss-s | Spanish has no 's — "el perro de Ana" reverses to "Ana's dog": owner first. |
| `en-split` | prep-place, time-prep | Spanish "en" splits three ways: in / on / at. Two notes, one per node, same family. |
| `saber-poder-merge` | can-ability | saber (skill) and poder (possibility/permission) both become "can". |
| `dummy-subject` | dummy-it | "Llueve" needs a subject in English: "IT is raining. IT's late. IT's cold." |
| `intonation-questions` | be-yesno-q | Word order (or do) marks English questions; rising intonation alone reads as a statement. |
| `time-son-las` | time-telling | "Son las tres" → "It's three o'clock" — singular "it's" always, plus o'clock. |
| `people-plural` | plural-irreg | "la gente ES" but "people ARE" — people is grammatically plural. |
| `mas-que` | comp-superl | "más grande que" → "-er than" for short adjectives, "more … than" for long ones — the split is new. |
| `ir-a-transfer` | going-to | POSITIVE transfer: "voy a viajar" maps word-for-word onto "I'm going to travel". Trust it. |
| `have-vs-tener-idioms` | have-got | hambre/sed/miedo idioms: "tengo hambre" → "I AM hungry" (be, not have). |
| `whose-de-quien` | poss-s (u24 review) | "¿De quién es esto?" → "Whose is this?" — one word does the whole job. |
| `wasnt-werent` | past-be | estaba/era/fue/estuvo all collapse into was/were — English past-be is simpler; don't look for the aspect split yet. |
| `ed-pronunciation` | past-reg | -ed has three sounds: /t/ (worked), /d/ (played), /ɪd/ (visited) — never "work-ED". |
| `false-friend-alert` | (unit-thematic, u10 jobs) | actualmente≠actually, embarazada≠embarrassed, librería≠library, éxito≠exit, asistir≠assist, carpeta≠carpet. |

### 8.2 Cognate credit rules (12)

Mechanics: at course start (and on vocab-band fill), for each EN item word, if an es
transform-rule applies and the transformed form appears in the es lexicon (edit distance ≤ 2
after transform, same initial letter), the engine seeds the word `priorKnown` at
**recognize** maturity (lazy FSRS seeding, adaptivity §4.3.3). Blacklisted false friends are
excluded per rule. This is the Language-Transfer accelerator (spine §1.8) and the "you already
know ~2,000 words" unit-0 card for es learners.

| rule_id (`es.cog.`) | pattern | examples | blacklist seeds |
|---|---|---|---|
| `cion-tion` | -ción → -tion | nación/nation, información/information | — |
| `sion-sion` | -sión → -sion | decisión/decision, televisión/television | — |
| `dad-ty` | -dad → -ty | universidad/university, ciudad/city | — |
| `mente-ly` | -mente → -ly | rápidamente/rapidly, finalmente/finally | actualmente→actually |
| `oso-ous` | -oso/-osa → -ous | famoso/famous, delicioso/delicious | — |
| `al-al` | -al → -al (identical) | animal, hospital, final, personal | — |
| `ista-ist` | -ista → -ist | artista/artist, turista/tourist | — |
| `ncia-nce` | -ancia/-encia → -ance/-ence | distancia/distance, paciencia/patience | — |
| `ble-ble` | -ble → -ble (identical) | posible/possible, terrible | sensible→sensitive |
| `ico-ic` | -ico → -ic/-ical | música/music, público/public, histórico/historical | — |
| `or-or` | -or → -or (identical) | doctor, actor, color, error | — |
| `latin-stem-verbs` | -ar/-er/-ir stem → bare verb | informar/inform, decidir/decide, visitar/visit | asistir→attend, pretender→intend |

### 8.3 Phoneme contrasts (12, priority order — HVPT minimal-pair drills from day 1)

| contrast_id (`es.ph.`) | label | example pairs | note |
|---|---|---|---|
| `i-vs-ih` | /iː/ vs /ɪ/ | sheep/ship, beat/bit, leave/live | Spanish has one /i/; the #1 es→en perception gap. |
| `s-clusters` | initial s+C | school/*eschool*, Spain/*eSpain*, street | Epenthesis trap: no e- before s-clusters. |
| `b-vs-v` | /b/ vs /v/ | berry/very, ban/van, boat/vote | es merges them; EN keeps lips vs teeth apart. |
| `ae-vs-uh` | /æ/ vs /ʌ/ | cat/cut, bat/but, ankle/uncle | Neither vowel exists in es. |
| `h-onset` | /h/ vs silent h | hello, hotel, house vs hour, honest | es h is silent; EN /h/ is breathed (except hour/honest). |
| `j-vs-y` | /dʒ/ vs /j/ | jet/yet, jam/yam, major | es y/ll varies by dialect; EN contrast is lexical. |
| `sh-vs-ch` | /ʃ/ vs /tʃ/ | ship/chip, share/chair, wash/watch | es lacks /ʃ/. |
| `ed-endings` | /t/–/d/–/ɪd/ | worked, played, visited | Ties to `past-reg`; drilled the same unit. |
| `z-vs-s` | /z/ vs /s/ | zoo/Sue, eyes/ice, prize/price | es has no voiced /z/ phoneme. |
| `ng-vs-n` | /ŋ/ vs /n/ | sing/sin, thing/thin, ban/bang | Word-final /ŋ/ without a /g/ release. |
| `er-vowel` | /ɜː/ | bird, work, first, learn | No es equivalent; anchor early ("work" is u10 vocab). |
| `schwa-reduction` | /ə/ in weak syllables | about, banana, chocolate | Prosody note: unstressed EN vowels reduce; es vowels never do. |

Priority = table order; the `phonology_focus: auto` slot serves the highest-priority contrast
whose FSRS phoneme item is unmastered.

---

## 9. Build, publish, versioning

1. `python lint_journey_pack.py courses/en` — must pass.
2. `python assign_items.py courses/en` — regenerates `assignments.generated.json`; diff reviewed.
3. `python build_journey_pack.py courses/en --version 0.1.0` — emits
   `build/journey_en-0.1.0.zip` (`manifest.json` with `entryType: "data"`,
   `databases: {"main": "data/course.sqlite3"}`, underscore id `journey_en`) +
   `build/coverage_report.md`.
4. `python publish_journey_pack.py build/journey_en-0.1.0.zip --channel preview` — uploads
   immutable zip to `s3://corpan-prod/artifacts/corpan/journey-packs/`, accumulate-merges
   `index.json` (never clobbers other courses), `max-age=300`.
5. App-side `journeyPackCatalog.ts` (cloned from `wordPackCatalog.ts`) resolves by
   `kind: "journey-course"` + `targetLang`; install via `content_packs_install_from_url`
   with explicit `packId` (wordpan id-derivation lesson).
6. Versioning: content fixes bump patch; item/unit ADDITIONS bump minor; any id removal or
   `item_key` change is forbidden without a major bump + engine migration note. Changelog:
   `dja/journey_pack/CHANGELOG.md` (Keep-a-Changelog; entry per shippable change).

---

## 10. Explicit non-goals of this spec (v0.1)

- Grammar nodes beyond A1 (stubs only), journey-es/zh content, imagepan integration
  (picture-choice consumes it when it exists; `picture-choice` items degrade to `match` until
  then), story-chapter authoring (runtime coverage gating handles readers), tutomaton
  free-grading, CEFR relabeling (D10.4 — `anchor(level)` absorbs it later), lemma linkage,
  official CEFR descriptor ids (licensing parked), and the D(L1,L2) multiplier matrix
  (es→en is Cat-I baseline ×1.0).
