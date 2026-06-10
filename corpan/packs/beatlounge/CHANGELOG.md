# Changelog — beatlounge

All notable changes to this pack are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Wave 0 — frozen spine.** New pack scaffold (`corpan/packs/beatlounge/`),
  the sibling-in-reverse of melopán: a dark, AI-driven, fully-featured beat
  sequencer that also teaches language.
  - Tick-addressed document model at PPQ 960 (`src/model/document.ts`) — up to
    128 beats per loop, exact 16th-triplets/32nds/dotted values, polymeter via
    per-track `lengthTicks`. Tamburás/tablas/drones/sine-pads are presets over
    generic instrument engines, not new code.
  - The one write path: typed `Command` union + pure `reduce()` with structural
    sharing + a `CommandBus` (undo/redo, transient preview keep/rollback,
    snapshot for the LLM). UI, the LLM tool DSL, and the phrase-sampler all
    funnel through it with zero special-casing.
  - Frozen engine contracts (`Instrument`/`Effect`/`Scheduler`/`AudioGraph`/
    `AssetLoader`) and the `BeatloungeModule`/`BeatloungeHost` UI contract that
    scales to infinite widgets and exposes each widget's actions to the LLM.
  - Rich host SDK types incl. the on-device LLM and the requested native
    `synthesizeToBuffer` TTS-capture capability (feature-detected).
  - Design-system foundation: `--bl-*` tokens, dark skins (midnight/noir/aurora),
    one `:root` z-scale, safe-area insets.
  - Pure-layer test suite (timing math, reducer purity/structural-sharing,
    command bus undo/redo/preview) gating the freeze.
