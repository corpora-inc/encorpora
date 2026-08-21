# Journey — Content Authoring Spec (`journey_en` v0.1)

**Status: v0.1 spec, implements ARCHITECTURE D6/D10/D11 (as amended by CTO-RESOLUTIONS R1).
Owner: curriculum authoring workstream.**
**Inputs:** `research/curriculum-spine.md` (spine + first-20-units draft), `research/pedagogy.md`
(§5 frequency, §6 grammar graph, §12 numeric rules), `research/adaptivity.md` (θ/`b`/probe
contract), `codebase/content-data.md` (corpus census, wordpan precedent, §6 new-pack-kind path).
**All corpus numbers in this document were re-verified against `dja/release.sqlite3` and the 34
phrase-pack `phrases.json` sources on 2026-07-03.**

This document is the **content authoring layer** for the `journey_en` v0.1 course pack.
**`specs/course-pack.md` is normative** (R1) for the SQLite DDL, manifest/index/S3 layout,
versioning, the app catalog module, and the single merged validation-gate list — everything
here *compiles to* that spec's schema and layout. What this spec owns: the authored unit YAML
semantics, the EN grammar-node graph (Launchpad + A1 authored in full), the item-assignment
pipeline (`assign_items.py`), the 30-unit outline, the corpus census, the content-side lint
rationale, calibration, and the es→en overlay v0.1.

Scope boundaries: the runtime engine (FSRS, θ, mixer) is D4 and specified in `engine.md` /
`research/adaptivity.md`; the feed UX is D7; pack format/distribution/app integration is
`course-pack.md`. This spec covers only what is *authored* on the Spark in `dja/journey_pack/`
and how it compiles down.

---

## 0. Repository layout — normative in course-pack.md §5

The `dja/journey_pack/` tree, tool inventory (`build_journey_pack.py`,
`validate_journey_pack.py`, `publish_journey_pack.py`), `courses/en/` structure
(course.yaml, grammar.yaml, `units/`, `overlays/`, `strings/`), pack id / zip naming
(`journey_en`, zip `journey_en-0.1.0.zip` — underscore, installer rule), S3 layout, and
channel gating are all specified in **course-pack.md §3–§5**. This spec adds only the
authoring-side files that live inside that same tree:

```
dja/journey_pack/
├── assign_items.py                       # §5 item pipeline (wordfreq + census + assignment)
├── calibration_report.py                 # §7.3 predicted-vs-actual (reads local sim / opt-in logs)
└── courses/en/
    └── items/
        ├── pins.yaml                     # hand-pinned ItemRefs per unit (overrides)
        └── assignments.generated.json    # OUTPUT of assign_items.py (checked in, reviewed in PR)
```

Content-side conventions carried over from the fleet:
- Authored YAML is source code, checked into git (same policy as `segments_<lang>.json`).
- Generated `assignments.generated.json` is ALSO checked in — assignment is reviewed, not
  opaque (translations-are-source-code discipline applied to curriculum).
- Course copy (unit themes, can-dos, grammar-node briefs, overlay bodies) ships in the pack
  **`strings` table** (course-pack.md §2), NOT as app-locale keys — D6 independence. Pack
  strings are authored/agent-translated JSON files under `courses/en/strings/` per
  course-pack.md §5 (JSON deliberately: sidesteps the Norwegian `"no"` YAML-boolean trap).
- YAML gotcha still applies to unit YAML: quote `"no"` anywhere Norwegian appears as a key.

---

## 1. Authored unit file format

One YAML file per unit under `courses/en/units/NNN-slug.yaml`. `NNN` is the course-wide intro
order (gaps allowed; lint enforces monotonicity with `ord`).

### 1.1 Schema (documented as commented YAML; JSON-Schema mirror lives at `courses/_schema/unit.schema.json`)

The authored unit file is a **superset of course-pack.md §5.1** — the extra fields here
(`pools`, `pins`, `words`, `recipe_mix`, `l1_slots`, `rare_cards`, `boss.remedial`, `notes`)
are authoring-side inputs that `assign_items.py` + `build_journey_pack.py` compile down to
course-pack.md's §5.1 shape and §2 DDL (mapping table in §2 below).

```yaml
unit:
  id: en.a1.u01            # REQUIRED. Course-pack unit-id grammar ('en.a1.u07' style;
                           # Launchpad = 'en.a0.uNN'). Immutable once shipped.
  arc: en.arc1             # REQUIRED. arcs.id per course-pack §2 ('en.arc0' = Launchpad).
  ord: 10                  # REQUIRED. Course-wide position (matches filename NNN).
  title: "Hello!"          # REQUIRED. EN display title → pack strings key (unit.<id>.theme
                           # family, course-pack §2 strings table). NOT an app-locale key.
  theme: greetings         # REQUIRED. Free-form editorial theme tag (lint: kebab-case).
  kind: teach              # teach | consolidate | gate  (default teach)

  cando:                   # REQUIRED for teach units. PARAPHRASE-ONLY (CEFR licensing parked —
                           # ARCHITECTURE "Open decisions"). Internal ids, our own wording.
                           # NO Council-of-Europe descriptor ids or verbatim text ships in the pack.
    - id: jcd.a1.intro-self
      text: "Introduce yourself and say who you are"
    - id: jcd.a1.greet
      text: "Greet people and respond to greetings"

  skills:                  # REQUIRED for teach units — course-pack §5.1 skills: block,
                           # verbatim. These become `skills` + `skill_edges` rows; every
                           # item this unit assigns joins ≥1 of them via `item_skills`.
    - id: en.skill.greetings
      kind: function
      title: "Greetings & introductions"
      b: -3.4
      prereqs: []

  grammar:                 # node ids from grammar.yaml (course-pack §5 layout)
    introduce: [en.gn.pron-subject, en.gn.be-1sg-2sg, en.gn.sv-order]
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
    provider: cap-squeeze            # v0.1 allowed set (R13): lingo_hero, earthgate
                                     # (or cap-segment-player), corpan_city, cap-pronounce,
                                     # cap-squeeze. Pack activityTypes are '<packId>:<name>'
                                     # (R4, activity-contract §1).
    activityType: "cap-squeeze:round"
    params: {itemset: unit}          # engine materializes itemRefs = this unit's items
    fallback: {provider: native, activityType: match_pairs}  # REQUIRED: feed must degrade if pack absent

  boss:                    # every teach unit ends in a task-boss (pedagogy charter #11);
                           # compiles to a course-pack §2 `checkpoints` row (scope='unit')
    recipe: boss
    scenario: "Meet three people: greet, exchange names, say goodbye."
    pass_score: 0.8
    must_include: [speak_echo, listen_pick]   # lint rule V-BOSS-1
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
    etym_gems: band        # band = wordpan paragraphs for this unit's words, compiled to
                           # `rare_cards` rows (card_type 'etymology'). Gems are rare-card
                           # FACES rolled by the engine — never a lesson-recipe slot (R4).
    # story: CUT from v0.1 (R11) — no storyChapter rows ship; DDL support remains.
    # See §6.1 v0.2 workstream.

  notes: |
    Authoring rationale, gap references, anything the next author needs.
```

### 1.2 Field semantics and contracts

- **`id` is immutable** once any version of the pack has shipped (FSRS/skill state keys by it).
  Retiring a unit = `kind: teach` → tombstone via `deprecated: true`, never deletion.
- **`skills`** — course-pack §5.1 verbatim: the skill DAG rows this unit introduces
  (kinds `grammar|vocab|phonology|script|function`). Grammar nodes attach to exactly one
  skill (course-pack Appendix A #4); `assign_items.py` writes every assigned item into
  `item_skills` for ≥1 of the unit's skills so derived mastery `I(s)` is total.
- **`cando`** — paraphrase-only. A private crosswalk (`courses/en/cando-crosswalk.private.md`,
  git-ignored) may map `jcd.*` ids to CEFR Companion Volume scales for authoring reference; it
  never ships and its text never gets copied into `text`.
- **`vocab_band.ranks`** are wordfreq ranks (§5.1). Bands across teach units in an arc must be
  contiguous and non-overlapping (band-monotonicity gate, course-pack §6.4); review/gate
  units carry `ranks: null`.
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
  arc: en.arc1
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

  skills:
    - id: en.skill.greetings
      kind: function
      title: "Greetings & introductions"
      b: -3.4
      prereqs: []
    - id: en.skill.be-statements
      kind: grammar
      title: "be: I am / you are"
      b: -3.5
      prereqs: []

  grammar:
    introduce: [en.gn.sv-order, en.gn.pron-subject, en.gn.be-1sg-2sg]
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
    provider: cap-squeeze                 # juice-squeeze gameplay via the cap-squeeze
    activityType: "cap-squeeze:round"     # capability module (R13/R15)
    params: {itemset: unit}
    fallback: {provider: native, activityType: match_pairs}

  boss:
    recipe: boss
    scenario: "Meet three people: greet each one, exchange names, ask how they are, say goodbye."
    pass_score: 0.8
    must_include: [speak_echo, listen_pick]
    remedial: {max_lessons: 2, target: weakest}

  l1_slots:
    contrastive_note: auto     # es resolves → es.note.pro-drop (subject pronouns are NOT optional)
    cognate_pass: auto
    phonology_focus: auto      # es resolves → es.ph.h-onset ("hello/hola": EN /h/ is voiced air, not silent)

  rare_cards:
    etym_gems: band            # e.g. wordpan("hello"), wordpan("goodbye" < "God be with ye")

  notes: |
    First unit of the course; every learner sees it unless placement skips Arc 1.
    Warm-win rule: first two cards must be listen_pick over pinned A0 items.
    Do NOT use phrase-learning here (it is not a greetings pack — verified 2026-07-03).
```

### 1.4 Recipes file (`recipes.yaml`, course-agnostic — course-pack §5 layout)

Recipes are named ordered slot lists that compile to course-pack §2 `lesson_recipes` +
`recipe_slots`. Slot `type` values are drawn from the **canonical `ACTIVITY_TYPES` registry
in `activityContract.ts` (normative table: activity-contract.md §1, per R4)** — the ten
native snake_case types — plus the scheduler pseudo-slots:

```
Native types (R4):       choice_pick, listen_pick, listen_type, cloze, word_order,
                         match_pairs, flip_recall, speak_echo, intro_echo, grammar_note
Scheduler pseudo-slots:  review.due, fluency.anchor, meta.recap, probe
```

Registry notes, applied throughout this spec (R4):
- **Translation direction is a PARAM** of `choice_pick` / `listen_type` / `cloze`, not a
  type. Notation here: `choice_pick[translate]` = L1↔L2 pick variant; `cloze[translate]` =
  typed-translation variant; `choice_pick[image]` = image-option params (imagepan; degrades
  to `match_pairs` until imagepan ships, §10).
- **`read-segment` is gone as a native type** — segment reading is a provider card via
  `earthgate` / `cap-segment-player` (anchor/provider slot, never a recipe `types:` entry).
- **`etym-gem` is a rare-card FACE**, rolled by the engine from `rare_cards`
  (card_type `etymology`) — not a schedulable type, not a recipe slot. The former `gem`
  recipe is deleted.
- `speak_echo` renders via the `cap-pronounce` capability module (R15).
- Recipes/bosses validate against the vendored `ACTIVITY_TYPES` constant (course-pack's
  merged gate list; CI drift check like `sync-contract.mjs`).

```yaml
recipes:
  core:                       # scaled-down v0.1 core lesson (~10 steps ≈ 5 min)
    - {slot: review.due, count: 2}                     # warm-up retrieval, FSRS-due, warm-win
    - {slot: input, types: [intro_echo, listen_pick, choice_pick], count: 3, new: true}
    - {slot: practice, types: [cloze, word_order, match_pairs, flip_recall], count: 3}
    - {slot: produce, types: [speak_echo, cloze], count: 1}   # cloze in [translate] typed mode
    - {slot: fluency.anchor, count: 0..1}              # only if unit anchor scheduled this lesson
    - {slot: meta.recap, count: 1}
  grammar-focus:
    - {slot: review.due, count: 2}
    - {slot: grammar_note, count: 1}                    # ≤60-second rule card, L1 early (charter #8)
    - {slot: input, types: [listen_pick], count: 2, feature: unit-grammar}
    - {slot: practice, types: [cloze, word_order], count: 4, feature: unit-grammar}
    - {slot: produce, types: [cloze, speak_echo], count: 1}   # cloze[translate]
    - {slot: meta.recap, count: 1}
  dialog:
    - {slot: review.due, count: 1}
    - {slot: input, types: [listen_pick, listen_type], count: 3, material: dialog}
    - {slot: produce, types: [speak_echo], count: 2, material: dialog}
    - {slot: meta.recap, count: 1}
  phonology:
    - {slot: input, types: [listen_pick], count: 4, material: minimal-pairs}   # HVPT perception
    - {slot: produce, types: [speak_echo], count: 2}
    - {slot: meta.recap, count: 1}
  review:
    - {slot: review.due, count: 8}
    - {slot: meta.recap, count: 1}
  boss:
    - {slot: probe, count: 6, mix: unit}                # mixed gauntlet over unit items
    - {slot: produce, types: [speak_echo], count: 1, required: true}
    - {slot: input, types: [listen_pick], count: 1, required: true}
    - {slot: review.due, count: 2, scope: older}        # spaced sample of pre-unit material
    - {slot: meta.recap, count: 1, celebrate: gate}
```

**The `story` recipe is CUT from v0.1 (R11)** — no unit schedules it and no story rare
cards ship; the `lesson_recipes`/`rare_cards` schema support remains in course-pack §2.
Units that had scheduled story lessons re-pool to listen-heavy input (`dialog`, extra
listen-weighted `core`) — see §6 and the §6.1 v0.2 workstream.

The renderer/mixer interprets recipes; the pack only *ships* them (course-pack §2
`recipe_slots` + `unit_lessons`). Strand accounting (pedagogy §12.1) is the mixer's job, not
the recipe's; recipes just guarantee raw material variety.

---

## 2. Compilation target — course-pack.md §2 (normative DDL)

The SQLite DDL formerly duplicated here is **deleted (R1)**: `build_journey_pack.py`
compiles `courses/en/**` into course-pack.md §2's schema, verbatim — `pack_meta`, `arcs`,
`units`, `skills`, `skill_edges`, `grammar_nodes`, `items`, `item_skills`, `lesson_recipes`,
`recipe_slots`, `unit_lessons`, `checkpoints`, `rare_cards`, `l1_overlays`, `strings`. The
`skills`/`item_skills`/`strings` tables are non-negotiable for the engine and D6.

Authored-construct → DDL mapping (the builder's contract):

| Authored (this spec) | Compiles to (course-pack §2) |
|---|---|
| `course.yaml` arcs | `arcs` (titles → `strings` keys) |
| unit YAML header (`id`, `arc`, `theme`, `cando`) | `units` row; theme/can-do copy → `strings` keys ×54 |
| unit `skills:` blocks (§1.1) | `skills` + `skill_edges` (from `prereqs`) |
| `grammar.yaml` inventory (§3) | `grammar_nodes` (briefs → `strings` note keys) + minted `grammarNode:` items; authored per-node prereqs compile to skill-level `skill_edges` + the global `node_order` (nodes attach to exactly one skill, course-pack Appendix A #4) |
| `pools`/`pins`/`words` + `assign_items.py` (§5) | `items` rows (`intro_order`, `difficulty_b`, `importance`, `is_probe`, `freq_rank`) + `item_skills` joins |
| `recipe_mix` + `recipes.yaml` (§1.4) | `lesson_recipes`/`recipe_slots` + per-unit `unit_lessons` |
| `boss` (§1.1) | `checkpoints` row, scope `unit`; arc gates → scope `arc` |
| `rare_cards.etym_gems` | `rare_cards` rows, card_type `etymology` (no `story` rows in v0.1 — R11) |
| overlays (§8) | `l1_overlays` rows + `ovl.<l1>.*` strings (`(l1, en)` only) |
| probe templates (§4) | `items` with `is_probe=1` |

`items.id` is the canonical ItemRef serialization `<kind>:<source>:<id>`
(activity-contract.md §1 is the one kind/source/id table; `itemRefKey()` is the one
helper — R2). Grammar nodes and phonemes are minted by this pack with
`source = 'journey_en'`. The cross-spec round-trip test (pack `items.id` through the helper)
lives with the contract.

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
  text) into `grammar.yaml` stubs per arc (course-pack §5 layout) → human spot-check pass
  ordering + prereq edges → lint (DAG acyclicity, unit-order consistency). journey-en and
  journey-es prove the format (D10.2); nothing beyond A1 blocks v0.1.
- **Compile mapping** (course-pack §2): each node becomes a `grammar_nodes` row (brief →
  `strings` note key, ×54) + one minted `grammarNode:journey_en:<id>` item. Nodes attach to
  exactly one skill; the authored per-node `prereqs` column compiles to skill-level
  `skill_edges` plus the global `node_order` (processability sequence) — finer-than-skill
  prerequisite structure is carried by `node_order`, per course-pack Appendix A #4.
- **Node granularity rule**: a node is the smallest grammar object the engine might want to
  *rewind to independently* (D4: "rewind past simple specifically"). If two phenomena are
  always taught, drilled, and remediated together, they are ONE node.
- **`late_acquired` flag**: nodes like 3rd-person `-s` and article mastery are tracked and
  recycled but never gate progression (pedagogy charter #8).
- **v0.1 ships**: the 43 authored nodes below with full briefs/probes, plus arc-stub rows for
  A2+ (id + name + arc only, `b` provisional, no unit references) so the DAG's forward edges
  have anchors. Stubs are excluded from the node↔unit consistency lint (§7.1, must-be-referenced).

### 3.2 Authored inventory — Launchpad + Arc A1 (43 nodes)

Notation: probe patterns use the template micro-DSL shipped with the probe items; type
names are the canonical R4 registry, with the translation/image variants as params:
`word_order: "tok / tok / ..."` (learner orders tokens), `cloze: "... ___ (hint) ..."`,
`listen_pick: "audio=X; options=[...]"`, `choice_pick[translate]: "L1 prompt;
options=[...]"`, `choice_pick[image]` (image options), `match_pairs`.
Every probe pattern must be renderable by a fast form (no speaking — adaptivity §4.2).
`b` values are logit-scale per adaptivity §2.3 (A1 core ≈ −3 … C2 ≈ +4).

| id (`en.gn.`) | name | brief (rule-card seed) | prereqs | b | probe patterns |
|---|---|---|---|---|---|
| `sv-order` | Basic word order | English sentences go Subject–Verb–(Object): "I eat apples." The order carries the meaning. | — | −3.6 | word_order: "I / am / Anna" ; word_order: "you / coffee / like" |
| `pron-subject` | Subject pronouns | I, you, he, she, it, we, they. English almost always needs the subject spoken — you can't drop it. | — | −3.6 | choice_pick[translate]: "ella → [she/her/he]" ; cloze: "___ am a teacher. (yo)" |
| `be-1sg-2sg` | be: I am / you are | "am" goes with I; "are" goes with you. "I am Anna. You are my friend." | sv-order, pron-subject | −3.5 | cloze: "I ___ a student." ; cloze: "You ___ very kind." |
| `be-all` | be: full present | am/is/are across all persons: he/she/it is; we/you/they are. | be-1sg-2sg | −3.3 | cloze: "She ___ a doctor." ; cloze: "They ___ from Peru." |
| `be-neg` | be: negation | Add "not" after be: "I am not tired. She isn't here." | be-all | −3.2 | word_order: "not / is / she / here" ; cloze: "We ___ not ready." |
| `be-yesno-q` | Yes/no questions with be | Flip be to the front: "You are tired." → "Are you tired?" | be-all | −3.2 | word_order: "you / are / hungry / ?" ; listen_pick: "audio='Is she your sister?'; options=[question/statement]" |
| `wh-quest-be` | Wh-questions with be | What/where/who/how + be + subject: "Where are you? What is this?" | be-yesno-q | −3.1 | word_order: "where / you / are / from / ?" ; cloze: "___ is your name? (question word)" |
| `articles-a-an` | a / an | "a" before consonant sounds, "an" before vowel sounds: a book, an apple. Use it for one, non-specific thing. | — | −3.3 | cloze: "She is ___ engineer." ; choice_pick[translate] |
| `dem-sg` | this / that | "this" = near, "that" = far. "This is my phone. That is your bag." | be-all | −3.2 | choice_pick[image] ; cloze: "___ is my house, over there." |
| `poss-adj` | Possessive adjectives | my, your, his, her, its, our, their — before the noun: "her book". | pron-subject | −3.2 | cloze: "That is ___ car. (he)" ; choice_pick[translate]: "su (de ella) → [her/his/your]" |
| `poss-s` | Possessive 's | Add 's to the owner: "Anna's dog", "my brother's car". English puts the owner FIRST. | poss-adj | −3.0 | word_order: "dog / Anna's / is / big" ; cloze: "This is my sister___ room." |
| `plural-reg` | Regular plurals | Add -s (or -es after s/sh/ch/x): one cat → two cats; one box → two boxes. | — | −3.2 | cloze: "three ___ (cat)" ; listen_pick: minimal audio "book/books" |
| `plural-irreg` | Irregular plurals | Some nouns change instead: man→men, woman→women, child→children, person→people, foot→feet. | plural-reg | −2.9 | cloze: "two ___ (child)" ; choice_pick[translate] |
| `numbers-1-100` | Numbers 1–100 | Cardinal numbers; the -teen vs -ty trap (thirteen/thirty). | — | −3.3 | listen_pick: "audio='thirty'; options=[13/30/33]" ; match_pairs: digits↔words |
| `time-telling` | Telling the time | "It's three o'clock. It's half past two. It's 7:15." Always start with "It's". | numbers-1-100, be-all | −3.0 | choice_pick[translate] ; cloze: "___ five o'clock. (time)" |
| `time-prep` | at / on / in (time) | at + clock time (at 5), on + days/dates (on Monday), in + months/years/parts of day (in May, in the morning). | time-telling | −2.9 | cloze: "See you ___ Monday." ; cloze: "The class starts ___ 9." |
| `like-want-noun` | like / want + noun | "I like coffee. I want water." Verb + thing, no extra word. | sv-order | −3.2 | word_order: "I / tea / want" ; choice_pick[translate] |
| `would-like` | I'd like (polite) | "I'd like a coffee, please" — the polite way to order or ask. | like-want-noun | −3.0 | cloze: "I'd ___ the soup, please." ; listen_pick |
| `some-any` | some / any | "some" in positives ("I have some money"), "any" in negatives and questions ("Do you have any money?"). | plural-reg | −2.8 | cloze: "Do you have ___ questions?" ; cloze: "There is ___ milk in the fridge." |
| `there-is-are` | there is / there are | To say something exists: "There is a bank. There are two cafes." Match is/are to the number. | be-all, plural-reg | −3.0 | cloze: "___ ___ a pharmacy near here?" ; choice_pick[image] |
| `prep-place` | Prepositions of place | in, on, under, next to, behind, in front of, between. | there-is-are | −3.0 | choice_pick[image] ; cloze: "The keys are ___ the table." |
| `art-the` | the (basic) | "the" = the one we both know: "the station", "the sun", second mention. No "the" for general plurals ("I like dogs"). | articles-a-an | −2.7 (late_acquired) | cloze: "Where is ___ bathroom?" ; choice_pick[translate] |
| `pres-simple-base` | Present simple (I/you/we/they) | For habits and facts: "I work at home. They live in Lima." | sv-order, pron-subject | −3.1 | word_order: "we / in Madrid / live" ; cloze: "I ___ (work) every day." |
| `adv-freq` | Adverbs of frequency | always, usually, often, sometimes, never — before the main verb, after be: "I always walk. She is never late." | pres-simple-base | −2.9 | word_order: "always / I / coffee / drink" ; cloze position pick |
| `pres-simple-3sg` | 3rd person -s | With he/she/it, the verb takes -s: "She works. He watches." The most-forgotten letter in English. | pres-simple-base | −2.8 (late_acquired) | cloze: "He ___ (work) in a bank." ; listen_pick: "audio='she works'; options=[work/works]" |
| `do-quest` | Questions with do/does | "Do you like tea? Does she work here?" — do/does starts the question; main verb stays bare. | pres-simple-base, pres-simple-3sg | −2.7 | word_order: "does / where / she / work / ?" ; cloze: "___ you speak English?" |
| `do-neg` | Negatives with don't/doesn't | "I don't know. She doesn't eat meat." — don't/doesn't + bare verb. | do-quest | −2.7 | cloze: "He ___ like fish. (negative)" ; word_order |
| `have-got` | have / has | Possession: "I have two brothers. She has a car." ("have got" recognized receptively.) | pres-simple-3sg | −2.8 | cloze: "She ___ a big family." ; choice_pick[translate] |
| `obj-pron` | Object pronouns | me, you, him, her, it, us, them — after the verb: "Call me. I see her." | pron-subject | −2.8 | cloze: "I love ___. (she)" ; choice_pick[translate] |
| `can-ability` | can / can't (ability) | "I can swim. He can't drive." — same form for everyone, verb stays bare. | pres-simple-base | −2.8 | cloze: "She ___ speak three languages." ; listen_pick: "audio='I can't come'; options=[can/can't]" |
| `can-request` | can (requests & permission) | "Can I have the menu? Can you help me?" — the everyday polite ask. | can-ability | −2.7 | word_order: "can / the bill / I / have / ?" ; choice_pick[translate] |
| `imperatives` | Imperatives | Tell someone what to do with the bare verb: "Turn left. Don't stop. Please wait." | sv-order | −2.9 | word_order: "left / turn / at the bank" ; choice_pick[image] (direction arrows) |
| `how-much-many` | How much / How many | many + countables ("How many apples?"), much + uncountables ("How much water?"); prices: "How much is it?" | some-any, plural-reg | −2.6 | cloze: "How ___ does it cost?" ; cloze: "How ___ people are coming?" |
| `pres-cont` | Present continuous | be + verb-ing for right now: "I am eating. They are working." | be-all, pres-simple-base | −2.6 | cloze: "Look! It ___ ___ (rain)." ; word_order |
| `simple-vs-cont` | Simple vs continuous | Habit vs. right now: "I drink coffee every day" vs "I am drinking coffee (now)". | pres-cont, adv-freq | −2.4 | choice_pick[translate] pairs ; cloze with time marker: "She usually ___ tea, but today she ___ coffee." |
| `dummy-it` | it for weather & time | English needs a subject even for weather/time: "It's raining. It's cold. It's late." | pres-cont, time-telling | −2.5 | word_order: "raining / it / is" ; choice_pick[translate]: "llueve → [It rains / It's raining / Is raining]" |
| `past-be` | was / were | Past of be: I/he/she/it was; you/we/they were. "I was at home. They were happy." | be-all | −2.5 | cloze: "Where ___ you yesterday?" ; cloze: "The film ___ great." |
| `past-reg` | Past simple: -ed | Add -ed for finished actions: "I worked. She visited her mother." Same form for all persons. | past-be, pres-simple-base | −2.4 | cloze: "We ___ (watch) a film last night." ; listen_pick: /t,d,ɪd/ ending audio |
| `past-irreg-top25` | Irregular past (top 25) | The 25 most common verbs change form: go→went, have→had, see→saw, do→did, get→got, make→made… | past-reg | −2.2 | match_pairs: base↔past ; cloze: "She ___ (go) to Rome in May." |
| `past-quest-neg` | did: questions & negatives | "Did you see it? I didn't go." — did carries the past; the main verb goes back to base form. | past-irreg-top25, do-quest | −2.1 | cloze: "___ you ___ (enjoy) the party?" ; word_order |
| `going-to` | going to (plans) | be + going to + verb for plans: "I'm going to visit my aunt tomorrow." | pres-cont | −2.2 | cloze: "We ___ ___ ___ travel in June." ; choice_pick[translate] (es "ir a" maps directly) |
| `comp-superl` | Comparatives & superlatives | Short adjectives: -er/-est (older, the oldest); long ones: more/most; irregulars: good→better→best, bad→worse→worst. Compare with "than". | plural-reg | −2.0 | cloze: "My city is ___ (big) than yours." ; cloze: "She is the ___ (good) player." |
| `conn-basic` | and / but / because | Join ideas: "I like tea and coffee. It's small but nice. I'm tired because I worked." | pres-simple-base | −2.3 | cloze pick: "It was raining, ___ we stayed home." ; word_order |

DAG sanity: every prereq is introduced in an earlier-or-same-`ord` unit (node↔unit
consistency lint, §7.1; DAG acyclicity is a course-pack §6.4 gate). The
Launchpad units introduce no grammar nodes (phoneme contrasts are `phoneme` ItemRefs, not
grammar nodes); `sv-order`/`pron-subject` fire in `en.a1.u01`.

---

## 4. Probe items

Probes serve two consumers: **placement** (adaptivity §4 — fast forms only) and **unit bosses**.

- Per grammar node, the builder materializes **2–4 probe items** from the authored probe
  templates (§3.2), instantiated with vocabulary from the node's home-unit band (guarantees
  a placement probe never fails on an unknown WORD when testing a STRUCTURE — lint
  V-PROBE-2: every content word in a probe instance must have zipf ≥ 4.3, i.e. ~top-3k).
- Probe items are `items` rows with `is_probe=1`, `b = node.b`, joined to the node's skill
  via `item_skills` (course-pack §2; probe coverage is a course-pack §6.4 gate).
- **Band-ladder probes stay inside the shipped content (R10):** the placement Phase 1
  ladder (adaptivity §4.3) spans only the `b` range actually present in the installed pack's
  `items` — it **caps at the max item `b`**, never probing difficulty the course cannot
  teach. For v0.1 (Launchpad + A1, item `b` ≈ −3.6 … −2.0) that means a short ladder
  entirely within the A1 band; higher rungs are added only as later arcs ship. Rungs are
  chosen by the builder as the highest-frequency, least ambiguous probe instances nearest
  each target `b`.
- **Above-content placement is an explicit outcome (R10):** placement Phase 2 terminates
  early with outcome `above-content` when `θ̂ − max_b > margin`; the PlacementResult carries
  honest copy ("this course currently covers A1; you're past it" — house no-absolutes rules
  apply). The placement sim gate (P8) runs against the real `journey_en` pack graph, not
  only the fixture, with personas scoped to shipped arcs.

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
- Book segments (`segment:` kind) are NOT unit-assigned in v0.1 — with story content cut
  (R11), no `segment:` items ship at all; earthgate/cap-segment-player anchor cards select
  segments at runtime. Story returns as a §6.1 v0.2 workstream once the coverage
  computation is real.

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
unassigned phrases → NOT compiled into the pack's `items` table (course-pack §2:
`items.unit_id` is NOT NULL). They remain corpus phrases the content resolver can serve
as distractor/encounter material at render time; promoting a reservoir into shipped
`items` is a v0.2 minor bump.
```

Notes:
- `grammar_hit` regexes ship IN `grammar.yaml` per node (optional `match:` field) — cheap,
  transparent, reviewable. No NLP dependency in v0.1.
- Every phrase has exactly one teach home or none. Cross-unit reuse happens at runtime through
  FSRS review, not through duplicate assignment.
- The whole assignment output is diffed in PR review (`assignments.generated.json`).

### 5.4 Word → unit assignment

- `mode: band`: unit gets all wordpan words with rank inside `vocab_band.ranks` that are not
  already pinned elsewhere, capped at `new_target`; overflow spills to the next unit in the
  same arc (lint warns when spill > 25%).
- Words with zipf < 3.0 (1,917 words) and not-in-wordfreq (102) never band-assign in Arcs 0–2;
  they remain reservoir items for B2+ authoring and etymology rare-card rolls.
- Word items are introduced at **recognize** form first (choice_pick[image] / listen_pick), per the
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

- `importance` uses course-pack §2's integer scale (0–3; one scale, engine-weight mapping
  owned by course-pack/engine): pins → 3 (core), band words and grammar nodes → 2
  (standard), pool-extra phrases → 1 (enrichment), rare-card-only payloads → 0.
- Ordering within a unit: grammar-node probe seeds first, then pinned phrases, then band
  words interleaved with scored phrases (so lesson 1 of a unit always has teachable
  material). The builder folds this per-unit order into the global `intro_order` sequence
  (course-pack §6.2 step 4).

### 5.7 Gap list → new dja phrase packs (D10.3)

Census-verified gaps in the corpus for the A1 outline (queries in §7.2): nationality
formulas (4 matches), telling-time (26), transactional shopping (25 "How much"-family),
home/furniture (3 furniture matches). Greetings are NOT a gap (97 A0/A1 base entries).

**v0.1 build-order prerequisites (R13, named workstream):** exactly TWO gap packs are on
the v0.1 critical path and are **sequenced BEFORE the journey pack build** — their
consuming units cannot pass the pool-floor gate without them. Built with the existing
`tools/phrase-packs` pipeline (facet model per `facets.py`, codex authoring, 54-language
fan-out, `channel: "preview"`):

| pack id | target size | level mix (A0/A1/A2/B1) | facets (WIDE-style, 3–4 each) | consuming units |
|---|---|---|---|---|
| `phrase-people-nationalities` | 120 | 20/60/30/10 | countries & "I'm from…"; nationality adjectives; languages spoken; "Where are you from?" dialog turns | u02 |
| `phrase-life-time-and-dates` | 160 | 30/70/40/20 | clock time; days & parts of day; dates, months, birthdays; schedules & "What time…?" | u04, u05 |

**Deferred to v0.2 (R13, with census evidence):** `phrase-life-shopping-basics` and
`phrase-life-home-and-furniture` are cut from the v0.1 critical path; their consuming units
re-pool to the base corpus where the census supports it:
- **u17 (Shopping & money)** re-pools to base "How much"-family (25 entries) +
  base:everyday A0/A1 money/price selectors — thin but combinable; the build report's
  per-unit pool floor (§7.2.4) is the arbiter, and if it fails the unit's deep shopping
  facets defer with the pack.
- **u12 (Colors & clothes)** re-pools to base:everyday A0/A1 (2,114 entries) with
  color/clothing `text_any` selectors — colors are core-band vocabulary, well covered.
- **u24 (House & home)** re-pools to **base:housing (174 A0/A1 entries — comfortably above
  the 40-candidate floor)**; only furniture-SPECIFIC terms (census: 3 matches) wait for the
  v0.2 pack.

Authoring constraints for all gap packs: every A0/A1 phrase's content words must sit within
the consuming unit's rank band (+20% slack) — this is lint rule V-GAP-1 run against the
pack's `phrases.json` before translation fan-out (cheaper to fix pre-translation). These
packs are ordinary phrase packs (also usable standalone); Journey references them by pack id
in `pools`.

---

## 6. Launchpad + Arc A1 — unit-by-unit outline (30 units)

D11 says "~30 authored units"; the research draft sketched 2+20. This spec expands to
**2 Launchpad + 28 A1** by splitting dense draft units (numbers/time, food/eating-out,
past×2 kept, weather and clothes/shopping separated, people-descriptions and free-time added)
and adding one consolidation + one production + one gate unit. Rank bands: 25 teach units cover
ranks 1–1,000 at ~40 ranks/unit (new_target ≈ 24–40 items incl. words). Unit sizing note:
v0.1 units are leaner than the spine's 12–18-lesson envelope (recipe_mix of 6–10) — first-pass
scope control; envelope grows in v0.2 without schema change.

Column key — **G**: grammar `introduce` (ids `en.gn.*`); **Pools**: `base:<domains>` at A0/A1
unless noted, `+pack` = phrase pack; **R**: recipe_mix summary; **A**: anchor provider —
**v0.1 anchors are restricted (R13) to `lingo_hero`, `earthgate` (or `cap-segment-player`),
`corpan_city`, `cap-pronounce`, `cap-squeeze`, or a native renderer**; `†v0.2 swap` marks a
unit whose intended anchor (beatlounge / hover_runner / tutomaton / stargate) is not
instrumented in v1 — pack data upgrades the anchor independently of the app.

| # | id | Title / theme | G | Ranks | Pools | R | A |
|---|---|---|---|---|---|---|---|
| 0 | `en.a0.u01` | The sounds of English (phonology; Latin-script L1s compress to 1 lesson) | — (phoneme items via overlay) | — | minimal-pair seeds tagged in base A0 | phonology ×3, core | cap-pronounce (HVPT perception + echo) |
| 1 | `en.a0.u02` | Survival kit (hello/thanks/yes/no, numbers 1–10, "I don't understand", "more slowly please"; embedded placement probes) | — | 1–30 | base:everyday A0 survival block (ids 27293+) | core ×2, review, boss | cap-squeeze |
| 2 | `en.a1.u01` | **Hello!** (worked example §1.3) | sv-order, pron-subject, be-1sg-2sg | 1–60 | base:everyday,social greeting selector (97 entries) | core×3, phonology, dialog, review, boss | cap-squeeze |
| 3 | `en.a1.u02` | Who are you? (countries & nationalities) | be-all, be-neg, be-yesno-q, wh-quest-be, articles-a-an | 60–100 | +`phrase-people-nationalities`; base:social | core×3, grammar-focus, dialog, boss | lingo_hero |
| 4 | `en.a1.u03` | My people (family) | poss-adj, poss-s, dem-sg | 100–140 | +`phrase-life-family-and-friends` (A0/A1: 128 entries); base:social | core×3, grammar-focus, dialog, boss | native choice_pick[image] |
| 5 | `en.a1.u04` | Numbers | numbers-1-100, plural-reg | 140–175 | base:numbers (A0+A1: 168) | core×2, grammar-focus, review, boss | lingo_hero †v0.2 swap: beatlounge |
| 6 | `en.a1.u05` | Time & dates | time-telling, time-prep | 175–210 | +`phrase-life-time-and-dates`; base:numbers,everyday | core×3, dialog, boss | cap-squeeze †v0.2 swap: beatlounge |
| 7 | `en.a1.u06` | Food & drink | like-want-noun, some-any | 210–250 | +`phrase-life-cooking-basics` (A0/A1: 128); base:everyday | core×3, phonology, boss | cap-squeeze |
| 8 | `en.a1.u07` | Eating out | would-like | 250–285 | +`phrase-travel-essentials` (A0/A1: 80); base:travel | core×2, dialog×2, boss | corpan_city |
| 9 | `en.a1.u08` | My town | there-is-are, prep-place, art-the | 285–330 | +`phrase-places-geography-world` (A0/A1: 128); base:housing,travel | core×3, grammar-focus, boss | corpan_city |
| 10 | `en.a1.u09` | Every day (routines) | pres-simple-base, adv-freq | 330–380 | base:everyday A1 | core×3, grammar-focus, dialog, boss | lingo_hero †v0.2 swap: hover_runner |
| 11 | `en.a1.u10` | She works (jobs) | pres-simple-3sg, do-quest, do-neg | 380–425 | +`phrase-work-office-basics` (A0/A1: 80); base:business | core×3, grammar-focus×2, boss | lingo_hero |
| 12 | `en.a1.u11` | My stuff (possessions) | have-got, plural-irreg, dem-pl* | 425–465 | +`phrase-tech-computers-basics` objects subset; base:everyday | core×3, review, boss | native choice_pick[image] |
| 13 | `en.a1.u12` | Colors & clothes | (review: poss-adj, dem-sg) | 465–500 | base:everyday color/clothing selectors (re-pooled per §5.7; v0.2: +`phrase-life-shopping-basics` clothes facet) | core×3, phonology, boss | native match_pairs |
| 14 | `en.a1.u13` | Can you? — **Mini-gate** | can-ability, can-request | 500–535 | base:everyday,social | core×2, grammar-focus, **boss+ = cumulative gauntlet u01–u13** | boss-only |
| 15 | `en.a1.u14` | Right now | pres-cont, simple-vs-cont | 535–575 | base:everyday; +`phrase-life-the-night` scene subset (A0/A1: 80) | core×3, grammar-focus, dialog, boss | earthgate / cap-segment-player (scene descriptions) †v0.2 swap: stargate |
| 16 | `en.a1.u15` | Weather & seasons | dummy-it | 575–610 | base:environment (A0/A1: 125); +`phrase-nature-birds-everyday` sky subset | core×2, dialog, review, boss | native choice_pick[image] |
| 17 | `en.a1.u16` | Getting around | imperatives | 610–650 | +`phrase-travel-essentials`; +`phrase-vehicles-cars-and-driving` (A0/A1: 80); base:travel | core×3, dialog, boss | corpan_city |
| 18 | `en.a1.u17` | Shopping & money | how-much-many | 650–690 | base "How much"-family (25) + everyday money/price selectors (re-pooled per §5.7; v0.2: +`phrase-life-shopping-basics`) | core×2, dialog×2 (shop role-play), boss | corpan_city (shop role-play) †v0.2 swap: tutomaton |
| 19 | `en.a1.u18` | People & descriptions | obj-pron | 690–725 | base:social A1 | core×3, grammar-focus, boss | native flip_recall |
| 20 | `en.a1.u19` | Free time & hobbies | (review: like-want-noun, adv-freq; like+-ing receptive) | 725–765 | +`phrase-sports-soccer-basics` (A0/A1: 79); +`phrase-arts-music-fundamentals` (A0/A1: 128) | core×3, dialog, boss | lingo_hero |
| 21 | `en.a1.u20` | Yesterday | past-be, past-reg | 765–810 | +`phrase-life-festivals-world` events (A0/A1: 127); base:everyday | core×3, grammar-focus×2, boss | native listen_type |
| 22 | `en.a1.u21` | Went, saw, did | past-irreg-top25, past-quest-neg | 810–855 | base:everyday,social | core×3, grammar-focus, dialog×2, boss | earthgate reader |
| 23 | `en.a1.u22` | Plans & invitations | going-to | 855–895 | +`phrase-life-family-and-friends`; base:social | core×3, dialog×2, boss | corpan_city (invitation role-play) †v0.2 swap: tutomaton scripted chat |
| 24 | `en.a1.u23` | Feeling good, feeling bad | (lexical: feel/hurt, should-advice receptive) | 895–930 | +`phrase-life-health-and-body` (A0/A1: 128); base:health (A0/A1: 243) | core×3, phonology, boss | cap-pronounce (speak_echo focus) |
| 25 | `en.a1.u24` | House & home | (review: there-is-are, prep-place; whose/mine receptive) | 930–965 | base:housing (A0/A1: 174; re-pooled per §5.7; v0.2: +`phrase-life-home-and-furniture`) | core×3, review, boss | native choice_pick[image] |
| 26 | `en.a1.u25` | Better, best | comp-superl | 965–1000 | +`phrase-sports-soccer-basics` comparison-rich; base:social | core×3, grammar-focus, boss | lingo_hero |
| 27 | `en.a1.u26` | The story so far (consolidation, `kind: consolidate`) | conn-basic; review: all weak nodes | — | pure FSRS harvest + reservoir | review×4, dialog | native |
| 28 | `en.a1.u27` | My story (integrative production) | (review: conn-basic + past + present) | — | learner-relevant reservoir sample | core, dialog, produce-heavy core×2, boss (3-sentence spoken+written self-narrative) | cap-pronounce (spoken self-narrative) †v0.2 swap: tutomaton |
| 29 | `en.a1.u28` | **Arc gate: A1 exam** (`kind: gate`) | — | — | probe items across all 43 nodes + can-do checklist | gate recipe (adaptive, placement-grade) | native probes + speak rubric |

*dem-pl (these/those) rides as a minor extension of `dem-sg` inside u11 — not a separate node.
†v0.2 swaps (R13): beatlounge (u04, u05), hover_runner (u09), stargate (u14), and tutomaton
(u17, u22, u27) are the units' intended anchors once those providers are instrumented; v0.1
ships them anchored to the allowed set above so every fluency centerpiece actually fires.
Swapping an anchor is a pack-data minor bump — no app change. Story lessons that the draft
outline scheduled in u03/u09/u14/u19/u21/u26 are re-pooled to listen-heavy input (`dialog` /
listen-weighted `core`) per R11.

Pool-size numbers cited (e.g. "A0/A1: 128" for family-and-friends) are the real per-pack
A0+A1 counts from the 2026-07-03 census (§7.2 table): DEEP packs have 128 A0+A1 entries,
WIDE packs 80, professional packs 8–15. Every teach unit above clears the V-POOL-1 floor
(≥ 40 teach candidates) except via combination with base-corpus pools — the per-unit
resolved counts are emitted by the build report (§7.2.3).

### 6.1 v0.2 workstreams (named, NOT v0.1 — do not start before v0.1 ships)

- **Story content (R11 follow-up):** a graded A1 micro-story narration pack, plus
  per-segment known-token lists computed at build/install time (Intl.Segmenter +
  irregular-form map onto `word:` items) so the 95% coverage gate is *measurable* before it
  gates anything. Only then do the `story` lesson recipe and `story` rare-card rows return
  to units (u03/u09/u14/u19/u21/u26 are the natural first consumers). Schema support ships
  now (course-pack §2 `lesson_recipes`/`rare_cards`); content does not.
- **Anchor swaps (R13):** beatlounge (u04/u05), hover_runner (u09), stargate (u14),
  tutomaton scripted-mode (u17/u22/u27) — swap in via pack-data minor bump once each
  provider is instrumented (activity-contract seam).
- **Deferred gap packs (R13):** `phrase-life-shopping-basics`, `phrase-life-home-and-furniture`
  (§5.7 census evidence; u12/u17/u24 re-pool in v0.1).

---

## 7. Validation & calibration

### 7.1 Content-side lint (merged into course-pack.md §6.4)

**There is ONE validation-gate list, and it lives in course-pack.md §6.4 (R1)** —
implemented in `validate_journey_pack.py`, runnable against the authored tree (fast, at
lint time) or the built sqlite (authoritative, at publish). The rules below are the
*content-side* members of that merged list, kept here with their authoring rationale; the
normative numbering (V-1..V-n) and the structural gates that were once duplicated here —
id hygiene, ItemRef resolution, DAG acyclicity, band monotonicity, strings completeness,
probe coverage, checkpoint/lesson integrity, difficulty sanity, immutability diff, meta
coherence — are course-pack.md's. Mnemonic names below are authoring-side handles only.

- **pool floor / V-POOL-1** (E): every teach unit's resolved pool ≥ max(40, 2×new_target) phrase
  candidates; (W) < 3×new_target. Rationale: a unit that cannot fill its recipes from real
  corpus is authored on hope. (This is the gate that arbitrates the §5.7 re-pools.)
- **pin integrity / V-POOL-2** (E): pinned includes exist in their source and are not excluded elsewhere.
- **probe validity / V-PROBE-1** (E): every authored node yields ≥2 valid probe instances; probe forms
  are fast forms only (no speaking — adaptivity §4.2).
- **probe vocabulary / V-PROBE-2** (E): probe-instance content words all zipf ≥ 4.3 — never test a
  structure through an unknown word.
- **gap-pack band fit / V-GAP-1** (E): gap-pack A0/A1 phrases' content words within consuming unit
  band × 1.2, run against `phrases.json` BEFORE translation fan-out (cheaper pre-translation).
- **can-do paraphrase** (E): every teach unit has ≥1 can-do; can-do `text` contains no
  8+-word verbatim substring of the CEFR CV descriptor corpus (checked against a local,
  non-shipped reference file); paraphrase-only licensing invariant.
- **copy bans** (E): banned-absolutes list ("forever", "never", "100%", "entirely",
  "always", "guaranteed") in any learner-facing string; (E) "flag/flagging" in any
  learner-facing string. Applies to pack `strings` content.
- **band-fill spill** (W): spill > 25% of a unit's word budget.
- **boss make-up / V-BOSS-1** (E): boss `must_include` ⊇ {speak_echo, listen_pick}; `pass_score`
  ∈ [0.7, 0.9]. Types validate against the vendored `ACTIVITY_TYPES` constant (R4).
- **anchor providers / V-ANCHOR-1** (E): anchor provider ∈ the R13 v0.1 allowed set (`lingo_hero`,
  `earthgate`/`cap-segment-player`, `corpan_city`, `cap-pronounce`, `cap-squeeze`) or
  `native`; `fallback.provider == native` always present.
- **recipe/type registry** (E): every recipe `types:` entry ∈ `ACTIVITY_TYPES` (R4; CI
  drift check like `sync-contract.mjs`); teach unit recipe_mix length 6–14, ≥1 `boss`;
  no `story` recipe scheduled in v0.1 (R11).
- **overlay resolution** (E): every `auto` l1 slot resolvable for every SHIPPED overlay
  language (v0.1: es); pinned overlay keys exist.
- **node↔unit consistency** (E): every `grammar.introduce`/`review` id exists in
  `grammar.yaml`; every non-stub node introduced by exactly one unit; every prereq
  introduced at `ord` ≤ the node's home unit `ord` (the unit-order face of the DAG gate).

i18n note (V-I18N-1 **deleted**, R1): authoring mints **no app-locale keys**. All course
copy — unit themes/titles, can-dos, grammar-node briefs, overlay bodies — ships in the pack
`strings` table (course-pack §2) and is gated by course-pack's strings-completeness gate
(×54 for spine copy; `(l1, en)` only for overlay keys). `npm run check:i18n` governs only
the app's own exercise-chrome strings, which are feed-ux's, not this spec's.

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
- **On-device (post-ship)**: the engine already logs `(items.id, b, θ_at_review, outcome)` in
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

Pack format, manifest, publish flow, index/S3 layout, app-side catalog, and the versioning
policy are **course-pack.md §3, §4, §7, §8 (normative)**. The authoring-side sequence:

0. **Build-order prerequisite (R13):** the `phrase-people-nationalities` and
   `phrase-life-time-and-dates` gap packs are built + fanned out FIRST (§5.7) — u02/u04/u05
   cannot pass the pool floor without them.
1. `python3 validate_journey_pack.py en --tree` — authored-tree mode of the single gate
   binary (course-pack §6.4 merged list); must pass.
2. `python3 assign_items.py courses/en` — regenerates `assignments.generated.json`; diff reviewed.
3. `python3 build_journey_pack.py en --version 0.1.0` — compiles to course-pack §2 DDL and
   emits `dist/journey_en-0.1.0.zip` (underscore zip name, installer rule — R1) +
   `build/coverage_report.md`, then re-runs the validator against the built sqlite.
4. `python3 publish_journey_pack.py en --channel preview` — course-pack §4.3 flow
   (immutability check, accumulate-merge `index.json`, `max-age=300`).
5. Versioning per course-pack §8: copy/`b` tuning bumps patch; item/unit ADDITIONS bump
   minor; any `items.id` removal/rename is forbidden without a major bump + engine
   migration note. Changelog: `dja/journey_pack/courses/en/CHANGELOG.md`
   (Keep-a-Changelog; entry per shippable change).

---

## 10. Explicit non-goals of this spec (v0.1)

- Grammar nodes beyond A1 (stubs only), journey-es/zh content, imagepan integration
  (`choice_pick` with image params consumes it when it exists; image variants degrade to
  `match_pairs` until then), story content of any kind (CUT per R11 — see the §6.1 v0.2
  workstream for the graded micro-story pack + coverage computation), tutomaton
  free-grading, CEFR relabeling (D10.4 — `anchor(level)` absorbs it later), lemma linkage,
  official CEFR descriptor ids (licensing parked), and the D(L1,L2) multiplier matrix
  (es→en is Cat-I baseline ×1.0).

---

## Tracked risks (panel round 1)

Pedagogy-fidelity lens risks relevant to this spec, preserved verbatim per R16. Non-blocking;
they inform build-time tests. Where a CTO ruling already addresses one (noted in brackets),
the risk stays pinned until the corresponding test exists.

- Anchor-provider coverage: the 30-unit outline assigns anchors to juice_squeeze (u01/u02/u06), beatlounge (u04/u05), hover_runner (u09), stargate (u14), tutomaton (u22/u27) — none instrumented in v1 (D11 instruments only lingo_hero, earthgate, corpan_city). ~60% of units' fluency centerpieces silently degrade to native `match`, weakening the fluency strand and the rare-card economy the outline implies. V-ANCHOR-1's 'known-provider registry' is undefined. *(addressed by R13 — §6 re-anchoring; pinned until the anchor-registry gate runs against the built pack)*
- Items outside the course graph: earthgate reports segment items as exposure-'pass'; engine getOrCreateCard for refs absent from graph.items (no b, no skills, no importance) is unspecced, and exposure-graded segments entering the DUE pool create re-read review demand the feed can't sensibly serve. Define: segment/anchor-only refs get logged but never carded, or carded with a no-review flag. *(engine-side contract; authoring keeps `segment:` refs out of unit item assignment — §5.2)*
- lingo-hero evidence granularity: waves quiz individual words but grades land on the whole phrase item; a phrase passes/fails on one word's catch. Capped at Good so damage is bounded, but expect noisy phrase-item scheduling; consider grading only when the wave's word is the phrase's rarest content word. *(informs anchor item authoring for lingo_hero-anchored units)*
- Corpus census minor drift: on-disk today = 33 phrase packs / 15,269 entries / 2,413 A0+A1 vs spec's '34 packs, 15,774, 2,493' — exactly one WIDE pack (~505 entries) missing. Also the four gap packs (nationalities, time-and-dates, shopping, home) are on the u02–u24 critical path but appear in no build-order/D11 workstream; each needs 54-language fan-out before its consuming unit can pass V-POOL-1. *(addressed by R13 — §5.7/§9 build-order prerequisites; census re-run at build embeds the truth in `pack_meta`)*
- Post-placement dead end for intermediates: with only A1 shipped, a correctly-placed A2+ learner lands past all content with just a TRICKLE backlog of 'known' items; no spec defines that surface state (course-complete? review-only mode?). Pairs with the placement-ceiling blocker. *(pairs with R10 — §4 `above-content` outcome; the post-placement surface state is feed-ux's to spec)*
- Translation volume on the critical path: course-pack V-4 requires ~380 pack string keys ×54 langs (incl. 80 grammar notes at ~350 chars) AND feed-ux adds ~110 app i18n keys ×54 under the hard check:i18n gate. House-proven workflow, but it is multiple agent-days of fan-out that no build-order slice owns. *(course-pack strings gate scope; a build-order slice must own the fan-out)*
- Sim ship-gates (P4 time-to-arc, P8 placement) initially run only on the synthetic fixture; require a gate run against the built journey_en CourseGraph before publish, or the gates validate a course that isn't the one shipping. *(addressed by R10 — §4: P8 runs against the real `journey_en` graph)*
