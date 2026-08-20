# Changelog

All notable changes to Kronopán are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). See
`corpan/CHANGELOGS.md` for the shared convention.

## [Unreleased]

### Added

- Dots notation mode, switchable live in the linear view without disturbing the
  clock. Each group is a cluster of circles, one per pulse, colored by group
  length, with constant dot size and spacing so a three-cluster is naturally
  wider than a two-cluster and clusters are separated by a larger gap. The active
  dot fills on its hit.
- Preset library of around three dozen cycles spanning many traditions
  (Bulgarian, Macedonian, Greek, Turkish, Arabic, Romanian, Irish, Afro-Cuban,
  and Indian tala) plus the plain meters that round out the low end (Polka 2/4,
  Waltz 3/4, March 4/4, Jig 6/8). Author-specified groupings are kept verbatim;
  where a source could not be confirmed the entry uses an honest figure name
  rather than a claimed dance, and debated internal orderings carry a note.
- Preset picker lists cycles chronologically by length with the pulse count
  shown, so it reads 2, 3, 4, 5 and upward.
- Label toggle in the linear view: show group lengths as numbers, or as
  short-long letters (S for a 2, L for a 3) so the shape reads without digits.
- Header now shows the collapsed time signature (for example 7/8) beside the
  additive figure and the dance name.

### Changed

- Editing a cycle now detaches it from its preset: the header shows "Custom" and
  the preset picker follows suit.

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
