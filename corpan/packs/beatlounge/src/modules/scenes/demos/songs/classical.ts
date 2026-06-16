/**
 * beatlounge — CLASSICAL demo songs (public-domain themes).
 *
 * Five universally-recognizable classical signature phrases, each from a work
 * whose composer died well over a century ago (so unambiguously public domain).
 * Transcribed as the recognizable opening phrase in the correct meter. Melody +
 * harmony only (no drums) — these are gentle starting points for a learner to
 * build on. Provenance is recorded in each `source`.
 */

import type { DemoSongSpec } from "../types"

/**
 * Bach (attr. Christian Petzold) — Minuet in G, BWV Anh. 114.
 * The famous opening: a stepwise descent from the high D over a G–D pulse, 3/4.
 * Key G major (tonic = 7). Melody around MIDI 67–86, bass on G/D.
 */
const minuetInG: DemoSongSpec = {
  id: "minuet-in-g",
  name: "Minuet in G",
  blurb: "Bach's stately minuet (by Petzold) — a graceful 3/4 dance in G major.",
  source: "Christian Petzold, Minuet in G (BWV Anh. 114, c.1725), long attributed to J.S. Bach — public domain.",
  bpm: 120,
  meter: { numerator: 3, denominator: 4 },
  bars: 4,
  tag: "classical",
  grooveId: "waltz",
  harmony: {
    tonic: 7, // G
    modeId: "western.ionian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "G", lenBeats: 6 },
      { beat: 6, symbol: "C", lenBeats: 3 },
      { beat: 9, symbol: "D", lenBeats: 3 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Harpsichord",
      presetId: "harpsichord",
      notes: [
        // Bar 1: D up to G, then A B G stepwise figure
        { beat: 0, pitch: 74, len: 1 },
        { beat: 1, pitch: 67, len: 0.5 }, { beat: 1.5, pitch: 69, len: 0.5 },
        { beat: 2, pitch: 71, len: 0.5 }, { beat: 2.5, pitch: 72, len: 0.5 },
        // Bar 2: D (half), then G A B
        { beat: 3, pitch: 74, len: 1 },
        { beat: 4, pitch: 67, len: 0.5 }, { beat: 4.5, pitch: 67, len: 0.5 },
        { beat: 5, pitch: 67, len: 1 },
        // Bar 3: E up to C, then C D E
        { beat: 6, pitch: 76, len: 1 },
        { beat: 7, pitch: 72, len: 0.5 }, { beat: 7.5, pitch: 74, len: 0.5 },
        { beat: 8, pitch: 76, len: 0.5 }, { beat: 8.5, pitch: 77, len: 0.5 },
        // Bar 4: D (half), then G A F#
        { beat: 9, pitch: 74, len: 1 },
        { beat: 10, pitch: 67, len: 0.5 }, { beat: 10.5, pitch: 69, len: 0.5 },
        { beat: 11, pitch: 71, len: 1 },
      ],
    },
    {
      role: "bass",
      name: "Cello",
      presetId: "upright-bass",
      notes: [
        { beat: 0, pitch: 43, len: 1 }, { beat: 1, pitch: 47, len: 1 }, { beat: 2, pitch: 50, len: 1 },
        { beat: 3, pitch: 43, len: 1 }, { beat: 4, pitch: 47, len: 1 }, { beat: 5, pitch: 50, len: 1 },
        { beat: 6, pitch: 48, len: 1 }, { beat: 7, pitch: 52, len: 1 }, { beat: 8, pitch: 55, len: 1 },
        { beat: 9, pitch: 50, len: 1 }, { beat: 10, pitch: 54, len: 1 }, { beat: 11, pitch: 45, len: 1 },
      ],
    },
  ],
}

/**
 * Mozart — Eine kleine Nachtmusik, K.525, opening (Allegro).
 * The rocketing G major arpeggio answer: G (up) D, G D, G D B G D… 4/4.
 * Tonic = 7 (G). Lead in the 67–86 range over a G/D pulse.
 */
const eineKleineNachtmusik: DemoSongSpec = {
  id: "eine-kleine-nachtmusik",
  name: "Eine kleine Nachtmusik",
  blurb: "Mozart's bright G-major opening — a confident leaping serenade theme.",
  source: "Wolfgang Amadeus Mozart, Eine kleine Nachtmusik (K.525, 1787) — public domain.",
  bpm: 132,
  meter: { numerator: 4, denominator: 4 },
  bars: 2,
  tag: "classical",
  harmony: {
    tonic: 7, // G
    modeId: "western.ionian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "G", lenBeats: 4 },
      { beat: 4, symbol: "D7", lenBeats: 4 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "String Section",
      presetId: "string-ensemble",
      notes: [
        // Bar 1: G..D | G..D | G D B G  (the iconic rising-then-falling figure)
        { beat: 0, pitch: 67, len: 0.75 }, { beat: 0.75, pitch: 62, len: 0.25 },
        { beat: 1, pitch: 67, len: 0.75 }, { beat: 1.75, pitch: 62, len: 0.25 },
        { beat: 2, pitch: 67, len: 0.5 }, { beat: 2.5, pitch: 74, len: 0.5 },
        { beat: 3, pitch: 71, len: 0.5 }, { beat: 3.5, pitch: 67, len: 0.5 },
        // Bar 2: D..A | D..A | D A F# D  (answering on the dominant)
        { beat: 4, pitch: 62, len: 0.75 }, { beat: 4.75, pitch: 57, len: 0.25 },
        { beat: 5, pitch: 62, len: 0.75 }, { beat: 5.75, pitch: 57, len: 0.25 },
        { beat: 6, pitch: 62, len: 0.5 }, { beat: 6.5, pitch: 69, len: 0.5 },
        { beat: 7, pitch: 66, len: 0.5 }, { beat: 7.5, pitch: 62, len: 0.5 },
      ],
    },
    {
      role: "bass",
      name: "Cello & Bass",
      presetId: "upright-bass",
      notes: [
        { beat: 0, pitch: 43, len: 1 }, { beat: 1, pitch: 43, len: 1 },
        { beat: 2, pitch: 43, len: 1 }, { beat: 3, pitch: 43, len: 1 },
        { beat: 4, pitch: 38, len: 1 }, { beat: 5, pitch: 38, len: 1 },
        { beat: 6, pitch: 38, len: 1 }, { beat: 7, pitch: 38, len: 1 },
      ],
    },
  ],
}

/**
 * Beethoven — Bagatelle "Für Elise", WoO 59, opening motif.
 * The famous E–D#–E–D#–E–B–D–C–A figure, 3/8 (a lilting triple). A minor.
 * Tonic = 9 (A). Right-hand melody mid-range, left-hand A-minor / E support.
 */
const furElise: DemoSongSpec = {
  id: "fur-elise",
  name: "Für Elise",
  blurb: "Beethoven's tender A-minor motif — the world's most-recognized piano opening.",
  source: "Ludwig van Beethoven, Bagatelle in A minor 'Für Elise' (WoO 59, c.1810) — public domain.",
  bpm: 70,
  meter: { numerator: 3, denominator: 8 },
  bars: 4,
  tag: "classical",
  harmony: {
    tonic: 9, // A
    modeId: "western.aeolian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "Am", lenBeats: 6 },
      { beat: 6, symbol: "E", lenBeats: 3 },
      { beat: 9, symbol: "Am", lenBeats: 3 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Grand Piano",
      presetId: "grand-piano",
      notes: [
        // Pickup + main figure (each eighth = 1 beat at /8 meter)
        { beat: 0, pitch: 76, len: 1 }, { beat: 1, pitch: 75, len: 1 }, { beat: 2, pitch: 76, len: 1 },
        { beat: 3, pitch: 75, len: 1 }, { beat: 4, pitch: 76, len: 1 }, { beat: 5, pitch: 71, len: 1 },
        { beat: 6, pitch: 74, len: 1 }, { beat: 7, pitch: 72, len: 1 }, { beat: 8, pitch: 69, len: 1 },
        // resolves to A; then rolled A-minor support figure into the next phrase
        { beat: 9, pitch: 57, len: 1 }, { beat: 10, pitch: 60, len: 1 }, { beat: 11, pitch: 64, len: 1 },
      ],
    },
    {
      role: "bass",
      name: "Left Hand",
      presetId: "grand-piano",
      volume: 0.7,
      notes: [
        { beat: 0, pitch: 45, len: 3 },
        { beat: 3, pitch: 45, len: 3 },
        { beat: 6, pitch: 40, len: 3 },
        { beat: 9, pitch: 45, len: 3 },
      ],
    },
  ],
}

/**
 * Pachelbel — Canon in D, the eight-chord ground bass.
 * The endlessly-looped D A Bm F#m G D G A progression, 4/4 (two beats each).
 * Tonic = 2 (D). A pizzicato-style pluck plays the rising melodic line over the
 * famous descending bass.
 */
const canonInD: DemoSongSpec = {
  id: "canon-in-d",
  name: "Canon in D",
  blurb: "Pachelbel's timeless eight-chord ground — the loop behind a thousand songs.",
  source: "Johann Pachelbel, Canon in D major (c.1680, publ. 1919) — public domain.",
  bpm: 64,
  meter: { numerator: 4, denominator: 4 },
  bars: 4,
  tag: "classical",
  harmony: {
    tonic: 2, // D
    modeId: "western.ionian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "D", lenBeats: 2 }, { beat: 2, symbol: "A", lenBeats: 2 },
      { beat: 4, symbol: "Bm", lenBeats: 2 }, { beat: 6, symbol: "F#m", lenBeats: 2 },
      { beat: 8, symbol: "G", lenBeats: 2 }, { beat: 10, symbol: "D", lenBeats: 2 },
      { beat: 12, symbol: "G", lenBeats: 2 }, { beat: 14, symbol: "A", lenBeats: 2 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Strings",
      presetId: "string-ensemble",
      notes: [
        // Pachelbel's first violin descant: F# E | D C# | B A | B C# | D C# | B A | G F# | G A
        { beat: 0, pitch: 78, len: 2 }, { beat: 2, pitch: 76, len: 2 },
        { beat: 4, pitch: 74, len: 2 }, { beat: 6, pitch: 73, len: 2 },
        { beat: 8, pitch: 71, len: 2 }, { beat: 10, pitch: 69, len: 2 },
        { beat: 12, pitch: 71, len: 2 }, { beat: 14, pitch: 73, len: 2 },
      ],
    },
    {
      role: "bass",
      name: "Ground Bass",
      presetId: "upright-bass",
      notes: [
        // The famous descending ground: D A B F# G D G A
        { beat: 0, pitch: 38, len: 2 }, { beat: 2, pitch: 45, len: 2 },
        { beat: 4, pitch: 47, len: 2 }, { beat: 6, pitch: 42, len: 2 },
        { beat: 8, pitch: 43, len: 2 }, { beat: 10, pitch: 38, len: 2 },
        { beat: 12, pitch: 43, len: 2 }, { beat: 14, pitch: 45, len: 2 },
      ],
    },
  ],
}

/**
 * Satie — Gymnopédie No. 1, opening.
 * The dreamy 3/4 left-hand pendulum (G–maj7 / D / …) under the descending
 * right-hand line. Tonic = 2 (D), Lydian-tinged but resolved as D major here.
 */
const gymnopedie: DemoSongSpec = {
  id: "gymnopedie-no-1",
  name: "Gymnopédie No. 1",
  blurb: "Satie's weightless 3/4 reverie — slow, spacious chords to float a melody over.",
  source: "Erik Satie, Gymnopédie No. 1 (1888) — public domain.",
  bpm: 66,
  meter: { numerator: 3, denominator: 4 },
  bars: 4,
  tag: "classical",
  grooveId: "waltz",
  harmony: {
    tonic: 2, // D
    modeId: "western.ionian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "Gmaj7", lenBeats: 3 },
      { beat: 3, symbol: "Dmaj7", lenBeats: 3 },
      { beat: 6, symbol: "Gmaj7", lenBeats: 3 },
      { beat: 9, symbol: "Dmaj7", lenBeats: 3 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Grand Piano",
      presetId: "grand-piano",
      notes: [
        // The opening descending melody phrase (enters over bar 3 in the score;
        // condensed here): F# A C# (held), then a gentle stepwise fall.
        { beat: 6, pitch: 78, len: 1.5 }, { beat: 7.5, pitch: 81, len: 1.5 },
        { beat: 9, pitch: 85, len: 1 }, { beat: 10, pitch: 83, len: 1 }, { beat: 11, pitch: 81, len: 1 },
      ],
    },
    {
      role: "mid",
      name: "Chord Pad",
      presetId: "warm-pad",
      volume: 0.55,
      notes: [
        // Left-hand chords: low bass note on beat 1, chord on beat 2 (the pendulum)
        { beat: 1, pitch: 62, len: 1 }, { beat: 2, pitch: 66, len: 1 },
        { beat: 4, pitch: 57, len: 1 }, { beat: 5, pitch: 61, len: 1 },
        { beat: 7, pitch: 62, len: 1 }, { beat: 8, pitch: 66, len: 1 },
        { beat: 10, pitch: 57, len: 1 }, { beat: 11, pitch: 61, len: 1 },
      ],
    },
    {
      role: "bass",
      name: "Bass",
      presetId: "upright-bass",
      volume: 0.6,
      notes: [
        { beat: 0, pitch: 43, len: 1 }, { beat: 3, pitch: 38, len: 1 },
        { beat: 6, pitch: 43, len: 1 }, { beat: 9, pitch: 38, len: 1 },
      ],
    },
  ],
}

export const CLASSICAL_DEMOS: DemoSongSpec[] = [
  minuetInG,
  eineKleineNachtmusik,
  furElise,
  canonInD,
  gymnopedie,
]
