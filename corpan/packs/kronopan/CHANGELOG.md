# Changelog

All notable changes to Kronopán are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). See
`corpan/CHANGELOGS.md` for the shared convention.

## [Unreleased]

## [0.1.0] - 2026-08-20

### Added

- Core cycle model and duration-proportional geometry, with unit tests. A cycle
  is a sequence of arbitrary positive-integer groups; a group of 3 always
  occupies 1.5 times the space of a group of 2.
- Internal clock and synthesized metronome. A Web Audio lookahead scheduler
  (25 ms wake, 100 ms ahead against the audio context clock) with three
  distinguishable click voices and four density levels (cycle, group heads,
  every pulse, subdivision). Tempo changes preserve phase; changing the cycle
  restarts it at the downbeat.
- Linear view in bars mode: one rounded bar per group with width proportional to
  its length, colored by group length, with faint interior pulse hairlines and a
  playhead locked to the audio clock on requestAnimationFrame.
- Group editor, tempo control, click-density and volume controls, a small preset
  library, and keyboard controls (space to start and stop, arrows for tempo).
