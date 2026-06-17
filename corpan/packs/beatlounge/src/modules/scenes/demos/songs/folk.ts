import type { DemoSongSpec } from "../types"

/**
 * European & American FOLK / TRADITIONAL demos — all unambiguously public domain
 * (traditional airs, or composed/published well before 1929). Each demo
 * transcribes the signature phrase of the tune as a short, loopable seed.
 */

/**
 * "Scarborough Fair" — traditional English ballad, in Dorian mode.
 * Signature opening: "Are you going to Scarborough Fair?" in 3/4.
 */
const scarboroughFair: DemoSongSpec = {
  id: "scarborough-fair",
  name: "Scarborough Fair",
  blurb: "A haunting English ballad in Dorian mode — gentle 3/4 waltz feel.",
  source: "Traditional English folk ballad — public domain.",
  bpm: 96,
  meter: { numerator: 3, denominator: 4 },
  bars: 8,
  tag: "folk",
  grooveId: "waltz",
  harmony: {
    tonic: 9, // A Dorian (A B C D E F# G)
    modeId: "western.dorian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "Am", lenBeats: 6 },
      { beat: 6, symbol: "G", lenBeats: 3 },
      { beat: 9, symbol: "Am", lenBeats: 3 },
      { beat: 12, symbol: "C", lenBeats: 3 },
      { beat: 15, symbol: "G", lenBeats: 3 },
      { beat: 18, symbol: "Am", lenBeats: 6 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Flute",
      presetId: "flute",
      notes: [
        // "Are you go-ing to Scar-bor-ough Fair?"
        { beat: 0, pitch: 69, len: 3 }, // A4  "Are"
        { beat: 3, pitch: 69, len: 1 }, // A4  "you"
        { beat: 4, pitch: 76, len: 2 }, // E5  "go-"
        { beat: 6, pitch: 76, len: 3 }, // E5  "-ing"
        { beat: 9, pitch: 79, len: 1 }, // G5  "to"
        { beat: 10, pitch: 81, len: 1 }, // A5  "Scar-"
        { beat: 11, pitch: 79, len: 1 }, // G5  "-bor-"
        { beat: 12, pitch: 77, len: 2 }, // F5  "ough"
        { beat: 14, pitch: 76, len: 1 }, // E5  "Fair?"
        { beat: 15, pitch: 74, len: 3 }, // D5
        { beat: 18, pitch: 72, len: 2 }, // C5
        { beat: 20, pitch: 69, len: 1 }, // A4
        { beat: 21, pitch: 69, len: 3 }, // A4
      ],
    },
    {
      role: "bass",
      name: "Upright Bass",
      presetId: "upright-bass",
      notes: [
        { beat: 0, pitch: 45, len: 6 }, // A2
        { beat: 6, pitch: 43, len: 3 }, // G2
        { beat: 9, pitch: 45, len: 3 }, // A2
        { beat: 12, pitch: 48, len: 3 }, // C3
        { beat: 15, pitch: 43, len: 3 }, // G2
        { beat: 18, pitch: 45, len: 6 }, // A2
      ],
    },
  ],
}

/**
 * "Greensleeves" — traditional English tune (first registered 1580),
 * here in A minor with its lilting 6/8 swing.
 */
const greensleeves: DemoSongSpec = {
  id: "greensleeves",
  name: "Greensleeves",
  blurb: "An Elizabethan English air with a wistful rise-and-fall melody in 3/4.",
  source: "Traditional English melody (registered 1580) — public domain.",
  bpm: 100,
  meter: { numerator: 3, denominator: 4 },
  bars: 4,
  tag: "folk",
  grooveId: "waltz",
  harmony: {
    tonic: 9, // A minor
    modeId: "western.aeolian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "Am", lenBeats: 3 },
      { beat: 3, symbol: "C", lenBeats: 3 },
      { beat: 6, symbol: "G", lenBeats: 3 },
      { beat: 9, symbol: "E", lenBeats: 3 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Harp",
      presetId: "harp",
      notes: [
        // Pickup "A-las" then the signature climb to C and fall back.
        { beat: 0, pitch: 69, len: 2 }, // A4  "A-"
        { beat: 2, pitch: 72, len: 1 }, // C5  "-las"
        { beat: 3, pitch: 74, len: 1.5 }, // D5  "my"
        { beat: 4.5, pitch: 76, len: 0.5 }, // E5  "love"
        { beat: 5, pitch: 77, len: 1 }, // F5
        { beat: 6, pitch: 76, len: 1 }, // E5  "you"
        { beat: 7, pitch: 74, len: 1.5 }, // D5  "do"
        { beat: 8.5, pitch: 71, len: 0.5 }, // B4  "me"
        { beat: 9, pitch: 69, len: 1 }, // A4  "wrong"
        { beat: 10, pitch: 67, len: 1 }, // G4
        { beat: 11, pitch: 69, len: 1 }, // A4
      ],
    },
    {
      role: "bass",
      name: "Upright Bass",
      presetId: "upright-bass",
      notes: [
        { beat: 0, pitch: 45, len: 3 }, // A2
        { beat: 3, pitch: 48, len: 3 }, // C3
        { beat: 6, pitch: 43, len: 3 }, // G2
        { beat: 9, pitch: 40, len: 3 }, // E2
      ],
    },
  ],
}

/**
 * "Drunken Sailor" — traditional sea shanty in D Dorian, driving and modal.
 * "What shall we do with the drunken sailor?"
 */
const drunkenSailor: DemoSongSpec = {
  id: "drunken-sailor",
  name: "Drunken Sailor",
  blurb: "A rollicking sea shanty in Dorian mode — strong steady march pulse.",
  source: "Traditional sea shanty — public domain.",
  bpm: 124,
  meter: { numerator: 4, denominator: 4 },
  bars: 4,
  tag: "folk",
  grooveId: "rock-backbeat",
  harmony: {
    tonic: 2, // D Dorian (D E F G A B C)
    modeId: "western.dorian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "Dm", lenBeats: 4 },
      { beat: 4, symbol: "C", lenBeats: 4 },
      { beat: 8, symbol: "Dm", lenBeats: 4 },
      { beat: 12, symbol: "Dm", lenBeats: 4 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Reed",
      presetId: "reed",
      notes: [
        // "What shall we do with the drun-ken sail-or"
        { beat: 0, pitch: 62, len: 0.5 }, // D4 "What"
        { beat: 0.5, pitch: 62, len: 0.5 }, // D4 "shall"
        { beat: 1, pitch: 62, len: 0.5 }, // D4 "we"
        { beat: 1.5, pitch: 62, len: 0.5 }, // D4 "do"
        { beat: 2, pitch: 64, len: 0.5 }, // E4 "with"
        { beat: 2.5, pitch: 65, len: 0.5 }, // F4 "the"
        { beat: 3, pitch: 64, len: 0.5 }, // E4 "drun-"
        { beat: 3.5, pitch: 62, len: 0.5 }, // D4 "-ken"
        { beat: 4, pitch: 60, len: 1 }, // C4 "sail-"
        { beat: 5, pitch: 60, len: 1 }, // C4 "-or"
        { beat: 6, pitch: 64, len: 1 }, // E4
        { beat: 7, pitch: 67, len: 1 }, // G4
        // "Ear-ly in the morn-ing"
        { beat: 8, pitch: 69, len: 0.5 }, // A4
        { beat: 8.5, pitch: 69, len: 0.5 }, // A4
        { beat: 9, pitch: 67, len: 0.5 }, // G4
        { beat: 9.5, pitch: 65, len: 0.5 }, // F4
        { beat: 10, pitch: 64, len: 1 }, // E4
        { beat: 11, pitch: 62, len: 1 }, // D4
        { beat: 12, pitch: 62, len: 2 }, // D4
      ],
    },
    {
      role: "bass",
      name: "Finger Bass",
      presetId: "finger-bass",
      notes: [
        { beat: 0, pitch: 38, len: 1 }, // D2
        { beat: 2, pitch: 45, len: 1 }, // A2
        { beat: 4, pitch: 36, len: 1 }, // C2
        { beat: 6, pitch: 43, len: 1 }, // G2
        { beat: 8, pitch: 38, len: 1 }, // D2
        { beat: 10, pitch: 45, len: 1 }, // A2
        { beat: 12, pitch: 38, len: 2 }, // D2
      ],
    },
    {
      role: "drums",
      name: "Rock Kit",
      kitId: "rock",
      grid: 16,
      notes: [
        { beat: 0, role: "kick" }, { beat: 1, role: "snare" },
        { beat: 2, role: "kick" }, { beat: 3, role: "snare" },
        { beat: 4, role: "kick" }, { beat: 5, role: "snare" },
        { beat: 6, role: "kick" }, { beat: 7, role: "snare" },
        { beat: 8, role: "kick" }, { beat: 9, role: "snare" },
        { beat: 10, role: "kick" }, { beat: 11, role: "snare" },
        { beat: 12, role: "kick" }, { beat: 13, role: "snare" },
        { beat: 14, role: "kick" }, { beat: 15, role: "snare" },
      ],
    },
  ],
}

/**
 * "Oh! Susanna" — Stephen Foster, 1848. Bright major tune in a country bounce.
 */
const ohSusanna: DemoSongSpec = {
  id: "oh-susanna",
  name: "Oh! Susanna",
  blurb: "Stephen Foster's bouncy minstrel-era favorite — a cheerful major romp.",
  source: "Stephen Foster, \"Oh! Susanna\" (1848) — public domain.",
  bpm: 120,
  meter: { numerator: 4, denominator: 4 },
  bars: 4,
  tag: "folk",
  grooveId: "country-train",
  harmony: {
    tonic: 0, // C major
    modeId: "western.ionian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "C", lenBeats: 4 },
      { beat: 4, symbol: "G", lenBeats: 4 },
      { beat: 8, symbol: "C", lenBeats: 4 },
      { beat: 12, symbol: "G", lenBeats: 2 },
      { beat: 14, symbol: "C", lenBeats: 2 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Honky-Tonk Piano",
      presetId: "honky-tonk",
      notes: [
        // "I come from A-la-bam-a with a ban-jo on my knee"
        { beat: 0, pitch: 60, len: 0.5 }, // C5? -> C4 "I"
        { beat: 0.5, pitch: 62, len: 0.5 }, // D4 "come"
        { beat: 1, pitch: 64, len: 1 }, // E4 "from"
        { beat: 2, pitch: 67, len: 1 }, // G4 "A-"
        { beat: 3, pitch: 67, len: 1 }, // G4 "-la-"
        { beat: 4, pitch: 69, len: 1 }, // A4 "bam-"
        { beat: 5, pitch: 67, len: 1 }, // G4 "-a"
        { beat: 6, pitch: 64, len: 1 }, // E4 "with"
        { beat: 7, pitch: 60, len: 1 }, // C4 "a"
        { beat: 8, pitch: 62, len: 1 }, // D4 "ban-"
        { beat: 9, pitch: 64, len: 1 }, // E4 "-jo"
        { beat: 10, pitch: 64, len: 1 }, // E4 "on"
        { beat: 11, pitch: 62, len: 1 }, // D4 "my"
        { beat: 12, pitch: 60, len: 1 }, // C4 "knee"
        { beat: 13, pitch: 62, len: 1 }, // D4
        { beat: 14, pitch: 64, len: 2 }, // E4
      ],
    },
    {
      role: "bass",
      name: "Upright Bass",
      presetId: "upright-bass",
      notes: [
        { beat: 0, pitch: 36, len: 1 }, // C2
        { beat: 2, pitch: 43, len: 1 }, // G2
        { beat: 4, pitch: 43, len: 1 }, // G2
        { beat: 6, pitch: 38, len: 1 }, // D2
        { beat: 8, pitch: 36, len: 1 }, // C2
        { beat: 10, pitch: 43, len: 1 }, // G2
        { beat: 12, pitch: 43, len: 1 }, // G2
        { beat: 14, pitch: 36, len: 2 }, // C2
      ],
    },
    {
      role: "drums",
      name: "Vintage Kit",
      kitId: "vintage-60s",
      grid: 16,
      notes: [
        { beat: 0, role: "kick" }, { beat: 1, role: "snare" },
        { beat: 2, role: "kick" }, { beat: 3, role: "snare" },
        { beat: 4, role: "kick" }, { beat: 5, role: "snare" },
        { beat: 6, role: "kick" }, { beat: 7, role: "snare" },
        { beat: 8, role: "kick" }, { beat: 9, role: "snare" },
        { beat: 10, role: "kick" }, { beat: 11, role: "snare" },
        { beat: 12, role: "kick" }, { beat: 13, role: "snare" },
        { beat: 14, role: "kick" }, { beat: 15, role: "snare" },
      ],
    },
  ],
}

/**
 * "Shenandoah" — traditional American river/sea song, slow and broad in 4/4.
 * "Oh Shenandoah, I long to hear you."
 */
const shenandoah: DemoSongSpec = {
  id: "shenandoah",
  name: "Shenandoah",
  blurb: "A broad, longing American river song — slow swells in a warm major key.",
  source: "Traditional American folk song — public domain.",
  bpm: 72,
  meter: { numerator: 4, denominator: 4 },
  bars: 4,
  tag: "folk",
  harmony: {
    tonic: 0, // C major
    modeId: "western.ionian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "C", lenBeats: 4 },
      { beat: 4, symbol: "F", lenBeats: 4 },
      { beat: 8, symbol: "C", lenBeats: 4 },
      { beat: 12, symbol: "G", lenBeats: 4 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "French Horn",
      presetId: "french-horn",
      notes: [
        // "Oh   Shen-an-doah,   I   long   to   hear   you"
        { beat: 0, pitch: 60, len: 1 }, // C4  "Oh"
        { beat: 1, pitch: 64, len: 1 }, // E4  "Shen-"
        { beat: 2, pitch: 67, len: 1 }, // G4  "-an-"
        { beat: 3, pitch: 72, len: 1 }, // C5  "-doah"
        { beat: 4, pitch: 69, len: 2 }, // A4
        { beat: 6, pitch: 67, len: 2 }, // G4
        { beat: 8, pitch: 64, len: 1 }, // E4  "I"
        { beat: 9, pitch: 67, len: 1 }, // G4  "long"
        { beat: 10, pitch: 64, len: 1 }, // E4  "to"
        { beat: 11, pitch: 60, len: 1 }, // C4  "hear"
        { beat: 12, pitch: 62, len: 2 }, // D4  "you"
        { beat: 14, pitch: 64, len: 2 }, // E4
      ],
    },
    {
      role: "mid",
      name: "Warm Pad",
      presetId: "warm-pad",
      volume: 0.5,
      notes: [
        { beat: 0, pitch: 48, len: 4 }, // C3
        { beat: 4, pitch: 53, len: 4 }, // F3
        { beat: 8, pitch: 48, len: 4 }, // C3
        { beat: 12, pitch: 55, len: 4 }, // G3
      ],
    },
    {
      role: "bass",
      name: "Upright Bass",
      presetId: "upright-bass",
      notes: [
        { beat: 0, pitch: 36, len: 4 }, // C2
        { beat: 4, pitch: 41, len: 4 }, // F2
        { beat: 8, pitch: 36, len: 4 }, // C2
        { beat: 12, pitch: 43, len: 4 }, // G2
      ],
    },
  ],
}

export const FOLK_DEMOS: DemoSongSpec[] = [
  scarboroughFair,
  greensleeves,
  drunkenSailor,
  ohSusanna,
  shenandoah,
]
