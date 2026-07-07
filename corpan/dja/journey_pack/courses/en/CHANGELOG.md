# Changelog — journey_en course pack

Content changes to the authored `courses/en/` tree (the shippable unit is
`journey_en-<version>.zip`). Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-07-04

### Published
- journey_en 0.1.0 to the preview channel (0.44 MB, 30 units, 693 items),
  alongside gap phrase packs `phrase-people-nationalities` and
  `phrase-life-time-and-dates` (54 languages each, preview) that units u02/u05
  pin into. Translation QA pass over the 52 machine-translated locales (W14);
  gap-pack translations regenerated ×54.

## [Unreleased]

## [0.2.0] — 2026-07-06

### Added
- **Arcs 2 + 3 authored: A2 "Everyday" (28 units) + B1 "Independence" (30 units).**
  The course grows 30 → 88 units (2,328 items, 125 grammar nodes, 86 skills,
  92 checkpoints), corpus-pinned throughout, with 69 new Spanish contrastive
  notes, new cognate credits, and /θ ð ʃ-ʒ/ + stress-shift phoneme drills.
  Placement now has headroom through B1. Three grammar gap packs
  (`phrase-life-then-and-now`, `phrase-life-what-if`,
  `phrase-social-small-talk`) supply structures the base corpus lacks.
- **Course strings + word glosses complete in all 54 languages** (V-5 green):
  846 keys per language — unit themes, can-dos, grammar notes, overlay-derived
  notes, and `wg.*` word glosses — translated natively, no English fallback.
- **Spanish word glosses `wg.<word>` (v0.2, contract #1).** Natural, course-
  sense-disambiguated es glosses for all 140 word items (e.g. `ship`→"el barco"
  in the sounds unit, `saw`→"vio" in the irregular-past unit, `order`→"pedir"
  in Eating out), plus `en` entries (the word, or a disambiguating gloss). These
  are the native FACE of word exercises — an ES learner no longer sees an
  English→English word card. `course.yaml` declares `l1_full_support: [es]`.
- journey_en v0.1 course sources (Journey W7, authoring.md): 30 authored
  units — 2 Launchpad (`en.a0.u01` sounds, `en.a0.u02` survival kit) + 28
  A1 units through the arc exam (`en.a1.u28`) — with skills, can-dos,
  vocab bands (wordfreq ranks), pinned base-corpus/gap-pack/word items,
  probe items (2–4 per skill, explicit `b`), auto phrase pools, lesson
  mixes, unit bosses, and R13-restricted anchors (lingo_hero, corpan_city,
  cap-pronounce, cap-squeeze, cap-segment-player, earthgate).
- 43-node A1 grammar graph (`en.gn.*`) with paraphrase-only rule-card
  briefs, global `node_order`, and `late_acquired` marks (art-the,
  pres-simple-3sg).
- es→en overlay v0.1: 39 contrastive notes (36 grammar-node + 3 unit),
  one course-level cognate-credit seed list (10 word items), and 12
  phoneme contrasts with minimal-pair drills.
- Rare-card economy v0.1: 8 etymology gems over pinned word items + 2
  delight cards. No story rows (R11).
- Pack strings ×54 locales (`strings/*.json`): en + es hand-authored;
  the other 52 agent-translated via the Vertex Gemini pipeline and
  banned-word/passthrough linted. Overlay `ovl.es.*` copy is
  hand-authored Spanish.
