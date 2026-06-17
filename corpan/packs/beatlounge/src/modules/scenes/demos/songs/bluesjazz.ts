/**
 * beatlounge — DEMO SONGS: Blues / early jazz / spirituals (all public domain).
 *
 * Each spec is plain JSON the compiler (../compile) turns into a playable loop.
 * Provenance is recorded in `source`. Pitches are MIDI (C4 = 60). Blues lines
 * lean on western.blues / minorPentatonic; the shuffle/second-line feel comes
 * from grooveId plus triplet-ish note placement.
 */

import type { DemoSongSpec } from "../types"

/**
 * 12-bar blues in E — the FORM (I-IV-V) is uncopyrightable; the riff here is an
 * original, simple boogie line written for it. Tonic E (pitch class 4).
 */
const twelveBarBluesE: DemoSongSpec = {
  id: "twelve-bar-blues-e",
  name: "12-Bar Blues in E",
  blurb: "The classic I-IV-V blues form with an original boogie riff — endlessly remixable.",
  source:
    "Original riff over the traditional 12-bar blues form (the form is public domain / uncopyrightable). Authored for beatlounge.",
  bpm: 96,
  meter: { numerator: 4, denominator: 4 },
  bars: 12,
  tag: "blues",
  grooveId: "shuffle",
  harmony: {
    tonic: 4, // E
    modeId: "western.blues",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "E7", lenBeats: 4 }, // I
      { beat: 4, symbol: "E7", lenBeats: 4 }, // I
      { beat: 8, symbol: "E7", lenBeats: 4 }, // I
      { beat: 12, symbol: "E7", lenBeats: 4 }, // I
      { beat: 16, symbol: "A7", lenBeats: 4 }, // IV
      { beat: 20, symbol: "A7", lenBeats: 4 }, // IV
      { beat: 24, symbol: "E7", lenBeats: 4 }, // I
      { beat: 28, symbol: "E7", lenBeats: 4 }, // I
      { beat: 32, symbol: "B7", lenBeats: 4 }, // V
      { beat: 36, symbol: "A7", lenBeats: 4 }, // IV
      { beat: 40, symbol: "E7", lenBeats: 4 }, // I
      { beat: 44, symbol: "B7", lenBeats: 4 }, // V (turnaround)
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Sax",
      presetId: "sax",
      notes: [
        // bluesy E minor-pentatonic call repeated, shuffled
        { beat: 0, pitch: 64, len: 0.66 }, // E
        { beat: 0.66, pitch: 67, len: 0.34 }, // G
        { beat: 1, pitch: 69, len: 0.66 }, // A
        { beat: 2, pitch: 70, len: 0.5 }, // Bb (blue note)
        { beat: 2.66, pitch: 71, len: 0.34 }, // B
        { beat: 3, pitch: 67, len: 1 }, // G
        { beat: 16, pitch: 69, len: 0.66 }, // A over IV
        { beat: 16.66, pitch: 72, len: 0.34 }, // C
        { beat: 17, pitch: 74, len: 0.66 }, // D
        { beat: 18, pitch: 71, len: 1 }, // B
        { beat: 32, pitch: 71, len: 0.66 }, // B over V
        { beat: 32.66, pitch: 74, len: 0.34 }, // D
        { beat: 33, pitch: 71, len: 0.66 }, // B
        { beat: 34, pitch: 67, len: 2 }, // G resolve
      ],
    },
    {
      role: "bass",
      name: "Upright Bass",
      presetId: "upright-bass",
      grid: 8,
      notes: [
        // Walking boogie root-3-5-6 per bar, shuffled eighths
        { beat: 0, pitch: 40 }, { beat: 0.66, pitch: 44 }, { beat: 1, pitch: 47 }, { beat: 1.66, pitch: 49 },
        { beat: 2, pitch: 40 }, { beat: 2.66, pitch: 44 }, { beat: 3, pitch: 47 }, { beat: 3.66, pitch: 49 },
        { beat: 16, pitch: 45 }, { beat: 16.66, pitch: 49 }, { beat: 17, pitch: 52 }, { beat: 17.66, pitch: 54 },
        { beat: 18, pitch: 45 }, { beat: 18.66, pitch: 49 }, { beat: 19, pitch: 52 }, { beat: 19.66, pitch: 54 },
        { beat: 32, pitch: 47 }, { beat: 32.66, pitch: 51 }, { beat: 33, pitch: 54 }, { beat: 33.66, pitch: 56 },
        { beat: 40, pitch: 40 }, { beat: 40.66, pitch: 44 }, { beat: 41, pitch: 47 }, { beat: 41.66, pitch: 49 },
      ],
    },
    {
      role: "drums",
      name: "Drums",
      kitId: "jazz-brushes",
      grid: 8,
      notes: [
        { beat: 0, role: "kick" }, { beat: 1, role: "snare" }, { beat: 2, role: "kick" }, { beat: 3, role: "snare" },
        { beat: 0, role: "ride" }, { beat: 0.66, role: "ride" }, { beat: 1, role: "ride" }, { beat: 1.66, role: "ride" },
        { beat: 2, role: "ride" }, { beat: 2.66, role: "ride" }, { beat: 3, role: "ride" }, { beat: 3.66, role: "ride" },
      ],
    },
  ],
}

/**
 * "When the Saints Go Marching In" — traditional American gospel / Dixieland
 * (19th-century spiritual; public domain). Key F (tonic pitch class 5).
 */
const whenTheSaints: DemoSongSpec = {
  id: "when-the-saints",
  name: "When the Saints Go Marching In",
  blurb: "The New Orleans second-line standard — bright, marching, and joyous.",
  source:
    "Traditional American gospel / spiritual, 19th century — public domain.",
  bpm: 120,
  meter: { numerator: 4, denominator: 4 },
  bars: 8,
  tag: "jazz",
  grooveId: "second-line",
  harmony: {
    tonic: 5, // F
    modeId: "western.ionian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "F", lenBeats: 8 },
      { beat: 8, symbol: "C7", lenBeats: 4 },
      { beat: 12, symbol: "F", lenBeats: 4 },
      { beat: 16, symbol: "F7", lenBeats: 4 },
      { beat: 20, symbol: "Bb", lenBeats: 4 },
      { beat: 24, symbol: "F", lenBeats: 4 },
      { beat: 28, symbol: "C7", lenBeats: 2 },
      { beat: 30, symbol: "F", lenBeats: 2 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Trumpet",
      presetId: "trumpet",
      notes: [
        // "Oh when the saints go marching in" — F major, pickup phrase
        { beat: 1, pitch: 65 }, { beat: 2, pitch: 69 }, { beat: 3, pitch: 70 }, { beat: 4, pitch: 72, len: 2 },
        { beat: 8, pitch: 65 }, { beat: 9, pitch: 69 }, { beat: 10, pitch: 70 }, { beat: 11, pitch: 72, len: 2 },
        { beat: 16, pitch: 65 }, { beat: 17, pitch: 69 }, { beat: 18, pitch: 70 }, { beat: 19, pitch: 72, len: 1 },
        { beat: 20, pitch: 69 }, { beat: 21, pitch: 65 }, { beat: 22, pitch: 69 }, { beat: 23, pitch: 67, len: 1 },
        // "be in that number..."
        { beat: 24, pitch: 65, len: 0.5 }, { beat: 24.5, pitch: 65 }, { beat: 25, pitch: 67 },
        { beat: 26, pitch: 65, len: 1 }, { beat: 28, pitch: 60, len: 2 }, { beat: 30, pitch: 65, len: 2 },
      ],
    },
    {
      role: "bass",
      name: "Upright Bass",
      presetId: "upright-bass",
      grid: 4,
      notes: [
        { beat: 0, pitch: 41, len: 1 }, { beat: 2, pitch: 48, len: 1 },
        { beat: 4, pitch: 41, len: 1 }, { beat: 6, pitch: 48, len: 1 },
        { beat: 8, pitch: 48, len: 1 }, { beat: 10, pitch: 43, len: 1 },
        { beat: 12, pitch: 41, len: 1 }, { beat: 14, pitch: 48, len: 1 },
        { beat: 16, pitch: 41, len: 1 }, { beat: 18, pitch: 48, len: 1 },
        { beat: 20, pitch: 46, len: 1 }, { beat: 22, pitch: 41, len: 1 },
        { beat: 24, pitch: 41, len: 1 }, { beat: 26, pitch: 48, len: 1 },
        { beat: 28, pitch: 48, len: 1 }, { beat: 30, pitch: 41, len: 1 },
      ],
    },
    {
      role: "drums",
      name: "Drums",
      kitId: "jazz-brushes",
      grid: 8,
      notes: [
        { beat: 0, role: "kick" }, { beat: 1, role: "snare" }, { beat: 1.5, role: "snare", vel: 0.5 },
        { beat: 2, role: "kick" }, { beat: 3, role: "snare" }, { beat: 3.5, role: "kick", vel: 0.5 },
        { beat: 0, role: "ride" }, { beat: 1, role: "ride" }, { beat: 2, role: "ride" }, { beat: 3, role: "ride" },
      ],
    },
  ],
}

/**
 * "St. James Infirmary" — traditional American blues / folk (public domain;
 * the trad melody predates and is distinct from the 1928 Primrose arrangement).
 * Minor key, slow and mournful. Key D minor (tonic pitch class 2).
 */
const stJamesInfirmary: DemoSongSpec = {
  id: "st-james-infirmary",
  name: "St. James Infirmary",
  blurb: "A slow, mournful minor blues — sparse and smoky.",
  source:
    "Traditional American blues/folk melody — public domain (trad. melody, distinct from copyrighted arrangements).",
  bpm: 76,
  meter: { numerator: 4, denominator: 4 },
  bars: 8,
  tag: "blues",
  grooveId: "swing",
  harmony: {
    tonic: 2, // D
    modeId: "western.aeolian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "Dm", lenBeats: 4 },
      { beat: 4, symbol: "Gm", lenBeats: 2 },
      { beat: 6, symbol: "A7", lenBeats: 2 },
      { beat: 8, symbol: "Dm", lenBeats: 4 },
      { beat: 12, symbol: "Gm", lenBeats: 2 },
      { beat: 14, symbol: "A7", lenBeats: 2 },
      { beat: 16, symbol: "Dm", lenBeats: 4 },
      { beat: 20, symbol: "Gm", lenBeats: 2 },
      { beat: 22, symbol: "A7", lenBeats: 2 },
      { beat: 24, symbol: "Dm", lenBeats: 4 },
      { beat: 28, symbol: "A7", lenBeats: 2 },
      { beat: 30, symbol: "Dm", lenBeats: 2 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Sax",
      presetId: "sax",
      notes: [
        // "I went down to St. James Infirmary..." — D natural minor
        { beat: 1, pitch: 62, len: 0.5 }, { beat: 1.5, pitch: 62, len: 0.5 },
        { beat: 2, pitch: 65, len: 1 }, { beat: 3, pitch: 67, len: 1 },
        { beat: 4, pitch: 69, len: 1.5 }, { beat: 6, pitch: 65, len: 1 }, { beat: 7, pitch: 62, len: 1 },
        { beat: 8, pitch: 62, len: 0.5 }, { beat: 8.5, pitch: 62, len: 0.5 },
        { beat: 9, pitch: 65, len: 1 }, { beat: 10, pitch: 67, len: 1 },
        { beat: 11, pitch: 69, len: 1 }, { beat: 12, pitch: 70, len: 1.5 },
        { beat: 14, pitch: 69, len: 1 }, { beat: 15, pitch: 69, len: 1 },
        { beat: 16, pitch: 65, len: 2 }, { beat: 18, pitch: 62, len: 2 },
      ],
    },
    {
      role: "mid",
      name: "Electric Piano",
      presetId: "electric-piano",
      grid: 4,
      notes: [
        // chord stabs on beats 2 & 4 (comping)
        { beat: 1, pitch: 62, len: 0.5 }, { beat: 1, pitch: 65, len: 0.5 }, { beat: 1, pitch: 69, len: 0.5 },
        { beat: 3, pitch: 62, len: 0.5 }, { beat: 3, pitch: 65, len: 0.5 }, { beat: 3, pitch: 69, len: 0.5 },
        { beat: 5, pitch: 60, len: 0.5 }, { beat: 5, pitch: 64, len: 0.5 }, { beat: 5, pitch: 67, len: 0.5 },
        { beat: 7, pitch: 61, len: 0.5 }, { beat: 7, pitch: 64, len: 0.5 }, { beat: 7, pitch: 69, len: 0.5 },
      ],
    },
    {
      role: "bass",
      name: "Upright Bass",
      presetId: "upright-bass",
      grid: 4,
      notes: [
        { beat: 0, pitch: 38, len: 2 }, { beat: 2, pitch: 45, len: 2 },
        { beat: 4, pitch: 43, len: 2 }, { beat: 6, pitch: 45, len: 2 },
        { beat: 8, pitch: 38, len: 2 }, { beat: 10, pitch: 45, len: 2 },
        { beat: 12, pitch: 43, len: 2 }, { beat: 14, pitch: 45, len: 2 },
      ],
    },
  ],
}

/**
 * "Swing Low, Sweet Chariot" — African-American spiritual, 19th century
 * (public domain). Warm and gospel. Key G (tonic pitch class 7).
 */
const swingLow: DemoSongSpec = {
  id: "swing-low-sweet-chariot",
  name: "Swing Low, Sweet Chariot",
  blurb: "The beloved spiritual — warm, hymn-like, and easy to sing along.",
  source:
    "African-American spiritual, 19th century (attrib. Wallace Willis) — public domain.",
  bpm: 84,
  meter: { numerator: 4, denominator: 4 },
  bars: 8,
  tag: "gospel",
  grooveId: "gospel-shout",
  harmony: {
    tonic: 7, // G
    modeId: "western.ionian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "G", lenBeats: 4 },
      { beat: 4, symbol: "C", lenBeats: 2 },
      { beat: 6, symbol: "G", lenBeats: 2 },
      { beat: 8, symbol: "G", lenBeats: 2 },
      { beat: 10, symbol: "D7", lenBeats: 2 },
      { beat: 12, symbol: "G", lenBeats: 4 },
      { beat: 16, symbol: "C", lenBeats: 2 },
      { beat: 18, symbol: "G", lenBeats: 2 },
      { beat: 20, symbol: "G", lenBeats: 2 },
      { beat: 22, symbol: "D7", lenBeats: 2 },
      { beat: 24, symbol: "G", lenBeats: 4 },
      { beat: 28, symbol: "D7", lenBeats: 2 },
      { beat: 30, symbol: "G", lenBeats: 2 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Grand Piano",
      presetId: "grand-piano",
      notes: [
        // "Swing low, sweet char-i-ot" — G major
        { beat: 0, pitch: 67, len: 1 }, { beat: 1, pitch: 71, len: 0.5 }, { beat: 1.5, pitch: 67, len: 0.5 },
        { beat: 2, pitch: 71, len: 2 },
        // "Comin' for to carry me home"
        { beat: 4, pitch: 74, len: 1 }, { beat: 5, pitch: 71, len: 1 }, { beat: 6, pitch: 67, len: 1 },
        { beat: 7, pitch: 64, len: 1 },
        { beat: 8, pitch: 67, len: 1 }, { beat: 9, pitch: 71, len: 1 }, { beat: 10, pitch: 74, len: 1 },
        { beat: 11, pitch: 71, len: 1 }, { beat: 12, pitch: 67, len: 3 },
        // second phrase
        { beat: 16, pitch: 67, len: 1 }, { beat: 17, pitch: 71, len: 1 }, { beat: 18, pitch: 67, len: 2 },
        { beat: 20, pitch: 74, len: 1 }, { beat: 21, pitch: 71, len: 1 }, { beat: 22, pitch: 67, len: 1 },
        { beat: 23, pitch: 62, len: 1 }, { beat: 24, pitch: 67, len: 4 },
      ],
    },
    {
      role: "bass",
      name: "Upright Bass",
      presetId: "upright-bass",
      grid: 4,
      notes: [
        { beat: 0, pitch: 43, len: 2 }, { beat: 2, pitch: 50, len: 2 },
        { beat: 4, pitch: 48, len: 2 }, { beat: 6, pitch: 43, len: 2 },
        { beat: 8, pitch: 43, len: 2 }, { beat: 10, pitch: 50, len: 2 },
        { beat: 12, pitch: 43, len: 2 }, { beat: 14, pitch: 50, len: 2 },
        { beat: 16, pitch: 48, len: 2 }, { beat: 18, pitch: 43, len: 2 },
        { beat: 20, pitch: 43, len: 2 }, { beat: 22, pitch: 50, len: 2 },
        { beat: 24, pitch: 43, len: 2 }, { beat: 28, pitch: 50, len: 2 }, { beat: 30, pitch: 43, len: 2 },
      ],
    },
  ],
}

/**
 * "Frankie and Johnny" — traditional American blues ballad, published widely
 * before 1900 (public domain). Bright, shuffling. Key C (tonic pitch class 0).
 */
const frankieAndJohnny: DemoSongSpec = {
  id: "frankie-and-johnny",
  name: "Frankie and Johnny",
  blurb: "The traditional barrelhouse blues ballad — a swinging I-IV-V toe-tapper.",
  source:
    "Traditional American blues ballad, 19th century — public domain.",
  bpm: 108,
  meter: { numerator: 4, denominator: 4 },
  bars: 8,
  tag: "blues",
  grooveId: "shuffle",
  harmony: {
    tonic: 0, // C
    modeId: "western.mixolydian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "C", lenBeats: 4 },
      { beat: 4, symbol: "C", lenBeats: 4 },
      { beat: 8, symbol: "C7", lenBeats: 4 },
      { beat: 12, symbol: "F", lenBeats: 4 },
      { beat: 16, symbol: "C", lenBeats: 4 },
      { beat: 20, symbol: "G7", lenBeats: 4 },
      { beat: 24, symbol: "C", lenBeats: 4 },
      { beat: 28, symbol: "G7", lenBeats: 2 },
      { beat: 30, symbol: "C", lenBeats: 2 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Grand Piano",
      presetId: "grand-piano",
      notes: [
        // "Frankie and Johnny were lovers..." — C major / mixolydian
        { beat: 0, pitch: 60, len: 0.66 }, { beat: 0.66, pitch: 62, len: 0.34 },
        { beat: 1, pitch: 64, len: 1 }, { beat: 2, pitch: 64, len: 0.66 }, { beat: 2.66, pitch: 62, len: 0.34 },
        { beat: 3, pitch: 64, len: 1 },
        { beat: 4, pitch: 67, len: 1 }, { beat: 5, pitch: 64, len: 1 }, { beat: 6, pitch: 60, len: 2 },
        { beat: 8, pitch: 60, len: 0.66 }, { beat: 8.66, pitch: 62, len: 0.34 },
        { beat: 9, pitch: 64, len: 1 }, { beat: 10, pitch: 67, len: 1 }, { beat: 11, pitch: 70, len: 1 },
        { beat: 12, pitch: 69, len: 1 }, { beat: 13, pitch: 65, len: 1 }, { beat: 14, pitch: 64, len: 2 },
        { beat: 16, pitch: 64, len: 1 }, { beat: 17, pitch: 62, len: 1 }, { beat: 18, pitch: 60, len: 2 },
        { beat: 20, pitch: 67, len: 1 }, { beat: 21, pitch: 65, len: 1 }, { beat: 22, pitch: 62, len: 2 },
        { beat: 24, pitch: 60, len: 2 },
      ],
    },
    {
      role: "bass",
      name: "Upright Bass",
      presetId: "upright-bass",
      grid: 8,
      notes: [
        { beat: 0, pitch: 36 }, { beat: 0.66, pitch: 40 }, { beat: 1, pitch: 43 }, { beat: 1.66, pitch: 45 },
        { beat: 2, pitch: 36 }, { beat: 2.66, pitch: 40 }, { beat: 3, pitch: 43 }, { beat: 3.66, pitch: 45 },
        { beat: 12, pitch: 41 }, { beat: 12.66, pitch: 45 }, { beat: 13, pitch: 48 }, { beat: 13.66, pitch: 50 },
        { beat: 14, pitch: 41 }, { beat: 14.66, pitch: 45 }, { beat: 15, pitch: 48 }, { beat: 15.66, pitch: 50 },
        { beat: 20, pitch: 43 }, { beat: 20.66, pitch: 47 }, { beat: 21, pitch: 50 }, { beat: 21.66, pitch: 52 },
        { beat: 24, pitch: 36 }, { beat: 24.66, pitch: 40 }, { beat: 25, pitch: 43 }, { beat: 25.66, pitch: 45 },
      ],
    },
    {
      role: "drums",
      name: "Drums",
      kitId: "vintage-60s",
      grid: 8,
      notes: [
        { beat: 0, role: "kick" }, { beat: 1, role: "snare" }, { beat: 2, role: "kick" }, { beat: 3, role: "snare" },
        { beat: 0, role: "closedHat" }, { beat: 0.66, role: "closedHat" }, { beat: 1, role: "closedHat" },
        { beat: 1.66, role: "closedHat" }, { beat: 2, role: "closedHat" }, { beat: 2.66, role: "closedHat" },
        { beat: 3, role: "closedHat" }, { beat: 3.66, role: "closedHat" },
      ],
    },
  ],
}

export const BLUESJAZZ_DEMOS: DemoSongSpec[] = [
  twelveBarBluesE,
  whenTheSaints,
  stJamesInfirmary,
  swingLow,
  frankieAndJohnny,
]
