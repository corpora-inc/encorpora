# Changelog — Hanzipan pack

Character-first handwriting studio for Mandarin. Distributed as a Corpán
pack via the `encorpora.io` catalog. Bundles its own SQLite for
character-stroke data.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.5.0] - 2026-05-10 — Earthgate retheme + Vite tooling

> Skipping 0.4.0 for tetraphobia — 四 (sì) shares its tone-distance from
> 死 (sǐ) too closely for a pack about Mandarin characters to wear.

### Changed
- Visual retheme to match Earthgate's parchment-and-gold language: flat
  `#f5f0e8` background (no more saturated radial orbs), Georgia serif
  for all UI text (Kaiti SC retained for the Chinese characters), warm
  brown / gold / sepia palette throughout, tighter 14 / 10 px
  border-radius scale.
- Calligraphy uses traditional black ink (`--char-ink: #1a1410`,
  near-black with the faintest warm undertone so it reads as sumi /
  墨 against the parchment instead of synthetic screen-black). The
  hero character, examples, and the user's drawn strokes all share
  this ink. UI text stays warm sepia (`--ink`) for Earthgate
  cohesion. Ghost guide stays faded sepia, target highlight stays
  gold, incorrect strokes stay warm red-brown.
- Score bar fill is a brown → gold → green gradient — the quality
  signal survives but starts in palette.
- Brush settings panel restyled to mirror the catalog drawer:
  parchment surface, gold pill tabs, brown sliders with a gold thumb,
  italic-Georgia preset selector. All physics / pressure / preset
  logic untouched.
- Wide-screen layout now fills the full viewport height: the workspace
  (draw + examples panels) becomes a `1fr` grid row that expands to
  consume every pixel between the hero card and the bottom-of-page
  padding. The two panels stretch with it, so the writing area gets
  generous practice-sheet space and the examples list reveals more
  cards without scrolling. Stacked / portrait layout below 1080 px
  width keeps its previous fixed-height clamp so it still scrolls
  comfortably on phones; the short-viewport overrides are now scoped
  to the stacked breakpoint only.
- Draw-panel toolbar buttons are now centered as one cluster with two
  intentional gaps — tight (8 px) within each semantic group and loose
  (24 px) between groups. The actions cluster (play, brush settings)
  and the modes/destructive cluster (free-draw, hints, clear) read as
  distinct units instead of being banished to opposite ends of the
  toolbar by `space-between`. Play stays at 56 px to keep its primary-
  action emphasis, mirroring Earthgate's transport-bar hierarchy.
- New 1024 × 1024 catalog avatar: 字 in sumi black with a faded sepia
  ghost layer offset behind it — visually narrates the app's mechanic
  (trace the guide, lay the ink) and replaces the legacy 796 × 694
  parchment-and-teal mark.

### Removed
- Two saturated radial color orbs in the root background.

### Build / Tooling
- Migrated to a Vite library build (matches world-radio /
  pronunciation-coach standard). New scripts: `npm run dev`,
  `npm run dev:corpan` (auto-rebuild + manifest devRevision bump +
  static server on `:8989`), `npm run build`, `npm run pack:all`.
- Source moved into `src/` (was top-level); `dist/` is now generated
  by Vite. `hanziwriter.min.js` stays at the pack root because it's
  fetched at runtime by `ensureHanziWriter` rather than bundled.

## [0.3.3] - 2025-11 — Killing and crushing hanzi (#150)
### Changed
- Polish pass on the writing flow.

## [0.3.0] - 2025-11 — Styles and brush stroke (#149)
### Added
- Brush-stroke first pass.
- Style refinements.

## [0.2.x] - 2025-11 (Corpán 0.9.2 #147)
### Changed
- Padding adjustments aligned with the Corpán app shell.

## Older

See `git log corpan/packs/hanzipan/` for early-development history.
