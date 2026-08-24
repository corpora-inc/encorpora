# Changelog

All notable changes to Kronopán are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). See
`corpan/CHANGELOGS.md` for the shared convention.

## [Unreleased]

## [0.2.3] - 2026-08-24

### Added

- Tap the screen to start and stop while in full-screen (swipe down still exits).

### Fixed

- Drag to reorder groups now works reliably with a mouse or a finger. It uses
  pointer capture so a touch-drag reorders instead of scrolling the controls, the
  dragged group lifts and follows the pointer with the drop target highlighted,
  and the order is committed once on release. The grip is a larger touch target.

## [0.2.2] - 2026-08-21

### Fixed

- Audio and visual are now tightly synced on device. The visual position is read
  at the moment the sound is actually heard by compensating for the audio output
  latency (large on iOS, especially over Bluetooth), so the playhead no longer
  runs ahead of the clicks. Scheduling is unchanged; only the drawn position
  shifts. Desktop was already in sync because its latency is negligible.
- The full-screen button no longer clips at the right edge in portrait: it now
  sits below the time signature on narrow screens.

## [0.2.1] - 2026-08-21

### Fixed

- Mobile layout, especially on iOS. The whole app now respects the safe-area
  insets (notch and home indicator) so nothing runs off the edges. The animation
  stage is the dominant area and the controls are capped and scroll instead of
  pushing the stage off screen or getting cut off at the bottom in landscape.
  Controls are more compact on phones.

### Added

- Full-screen mode for the animation: a Full button in the header expands it to
  fill the screen; swipe down, tap Exit, or press Escape to leave.

## [0.2.0] - 2026-08-21

### Added

- Pickable metronome voices, all synthesized: Tonal, Dumbek (a low DUM on the
  downbeat and group heads with a bright KA/tek on the interior pulses, so the
  additive grouping is audible), Woodblock, Rim, Cowbell, and a soft Shaker.
  Picking a voice auditions a short pattern so you hear it right away. The
  click-density control (cycle, group heads, every pulse, subdivision) still
  chooses whether you hear only the tops of the groups or fill them in.
- Heptadecagonal, a seventeen from the song by Umanistan, added to the preset
  library. Groups of four or more can be subdivided into 2s and 3s from the
  editor.
- Groups can be reordered by dragging them by their handle, with a mouse or a
  finger.
- Three skins, selectable in the controls, reusing palettes from sibling packs:
  Astral (stargate-reader near-black and cyan, with a faint starfield), Tropical
  (juice-squeeze light with juice red and fruit colors), and Earthy
  (earthgate-reader cream, brown, and orange). Skins are purely cosmetic (a
  palette swap plus the starfield on Astral); layout, timing, and readability are
  unchanged, the three group colors stay distinct in every skin, and bar digits
  stay dark on the light skins.
- Ring, spiral, and spin views, switchable live alongside the linear view (keys
  1 to 4). The ring wraps the cycle into an annulus with a needle fixed at twelve
  o'clock and the disc rotating under it (turntable posture); under reduced
  motion the disc holds still and a marker sweeps instead. The spiral is a vinyl
  groove that starts as a small circle near the center and winds outward in a few
  wide turns, lighting up as it plays and resetting to the center at the rim.
  Spin is the same groove turning like a record under a fixed top playhead that
  climbs outward from the center. The ring honors the active bars or dots
  notation; all views light the playing pulse.
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

- Tempo now reads like a metronome or DJ deck: bpm is the musical beat and the
  pulse is an eighth (two pulses per beat), independent of a cycle's notated
  unit. Stepping through presets keeps a steady, sensible tempo, so a normal
  dance speed sits at a normal number instead of needing a frantic bpm, and the
  unit (1/4, 1/8, 1/16) only sets the notation, not the speed.
- Editing a cycle now detaches it from its preset: the header shows "Custom" and
  the preset picker follows suit.

### Fixed

- Dots no longer clip at the left and right edges: the row is inset by one dot
  radius so the first and last dots sit fully on screen.
- The playhead no longer flashes at the end of the cycle for a moment when you
  press Start or swap the cycle; it now waits on the downbeat during the short
  audio pre-roll.
- Stopping, or switching the cycle while playing, no longer lets the previous
  click track ring out: scheduled clicks still in the lookahead window are
  faded out cleanly.

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
