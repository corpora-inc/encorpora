# Changelog — journey_en course pack

Content changes to the authored `courses/en/` tree (the shippable unit is
`journey_en-<version>.zip`). Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
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
