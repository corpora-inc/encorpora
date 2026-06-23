import type { DemoSongSpec } from "../types"

/**
 * WORLD / LATIN groove-forward demos — all traditional / public-domain melodies
 * (or original riffs laid over a public-domain groove form). Each picks a
 * matching world groove + kit and leans on a real bass + percussion arrangement.
 */

/**
 * "Hava Nagila" — traditional Jewish / klezmer celebration tune, here in
 * E Phrygian Dominant (the "Freygish" / Ahava Rabbah sound). Builds from a slow
 * lilt; we take the signature opening line over a maqsum-flavored frame drum.
 */
const havaNagila: DemoSongSpec = {
  id: "hava-nagila",
  name: "Hava Nagila",
  blurb: "A klezmer celebration in Phrygian Dominant — frame-drum maqsum and a driving bass.",
  source: "Traditional Jewish/klezmer melody (Hava Nagila) — public domain.",
  bpm: 116,
  meter: { numerator: 4, denominator: 4 },
  bars: 4,
  tag: "world",
  grooveId: "maqsum",
  harmony: {
    tonic: 4, // E Phrygian Dominant (E F G# A B C D)
    modeId: "western.phrygianDominant",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "Em", lenBeats: 4 }, // i area / drone
      { beat: 4, symbol: "B7", lenBeats: 4 }, // dominant pull
      { beat: 8, symbol: "Em", lenBeats: 4 },
      { beat: 12, symbol: "B7", lenBeats: 4 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Oboe",
      presetId: "oboe",
      notes: [
        // "Ha-va na-gi-la, ha-va na-gi-la" — climbing minor-third figures.
        { beat: 0, pitch: 64, len: 0.5 }, // E4
        { beat: 0.5, pitch: 65, len: 0.5 }, // F4
        { beat: 1, pitch: 64, len: 0.5 }, // E4
        { beat: 1.5, pitch: 65, len: 0.5 }, // F4
        { beat: 2, pitch: 68, len: 1 }, // G#4
        { beat: 3, pitch: 67, len: 1 }, // G4? -> keep G#: use 68
        { beat: 4, pitch: 64, len: 0.5 }, // E4
        { beat: 4.5, pitch: 65, len: 0.5 }, // F4
        { beat: 5, pitch: 64, len: 0.5 }, // E4
        { beat: 5.5, pitch: 65, len: 0.5 }, // F4
        { beat: 6, pitch: 68, len: 2 }, // G#4
        // second line lifts up to B
        { beat: 8, pitch: 69, len: 0.5 }, // A4
        { beat: 8.5, pitch: 71, len: 0.5 }, // B4
        { beat: 9, pitch: 69, len: 0.5 }, // A4
        { beat: 9.5, pitch: 68, len: 0.5 }, // G#4
        { beat: 10, pitch: 65, len: 1 }, // F4
        { beat: 11, pitch: 64, len: 1 }, // E4
        { beat: 12, pitch: 65, len: 0.5 }, // F4
        { beat: 12.5, pitch: 68, len: 0.5 }, // G#4
        { beat: 13, pitch: 71, len: 1 }, // B4
        { beat: 14, pitch: 64, len: 2 }, // E4 resolve
      ],
    },
    {
      role: "bass",
      name: "Finger Bass",
      presetId: "finger-bass",
      notes: [
        { beat: 0, pitch: 40, len: 1 }, // E2
        { beat: 2, pitch: 47, len: 1 }, // B2
        { beat: 4, pitch: 47, len: 1 }, // B2 (dom)
        { beat: 6, pitch: 42, len: 1 }, // F#2 leading
        { beat: 8, pitch: 40, len: 1 }, // E2
        { beat: 10, pitch: 47, len: 1 }, // B2
        { beat: 12, pitch: 47, len: 1 }, // B2
        { beat: 14, pitch: 40, len: 2 }, // E2
      ],
    },
    {
      role: "drums",
      name: "Frame Drum",
      kitId: "middle-eastern",
      grid: 16,
      notes: [
        // maqsum feel: Dum-tek-tek across each bar + shaker pulse
        { beat: 0, role: "kick" }, { beat: 1, role: "rim" }, { beat: 1.5, role: "rim" },
        { beat: 2, role: "kick" }, { beat: 3, role: "rim" },
        { beat: 4, role: "kick" }, { beat: 5, role: "rim" }, { beat: 5.5, role: "rim" },
        { beat: 6, role: "kick" }, { beat: 7, role: "rim" },
        { beat: 8, role: "kick" }, { beat: 9, role: "rim" }, { beat: 9.5, role: "rim" },
        { beat: 10, role: "kick" }, { beat: 11, role: "rim" },
        { beat: 12, role: "kick" }, { beat: 13, role: "rim" }, { beat: 13.5, role: "rim" },
        { beat: 14, role: "kick" }, { beat: 15, role: "rim" },
        // shaker on every beat
        { beat: 0, role: "shaker" }, { beat: 1, role: "shaker" }, { beat: 2, role: "shaker" }, { beat: 3, role: "shaker" },
        { beat: 4, role: "shaker" }, { beat: 5, role: "shaker" }, { beat: 6, role: "shaker" }, { beat: 7, role: "shaker" },
        { beat: 8, role: "shaker" }, { beat: 9, role: "shaker" }, { beat: 10, role: "shaker" }, { beat: 11, role: "shaker" },
        { beat: 12, role: "shaker" }, { beat: 13, role: "shaker" }, { beat: 14, role: "shaker" }, { beat: 15, role: "shaker" },
      ],
    },
  ],
}

/**
 * "La Cucaracha" — traditional Mexican folk song. Bright C major, set over a
 * cumbia groove with congas + a walking-ish bass that locks to the downbeat.
 */
const laCucaracha: DemoSongSpec = {
  id: "la-cucaracha",
  name: "La Cucaracha",
  blurb: "The Mexican folk staple over a cumbia groove — congas, claps and a bouncing bass.",
  source: "Traditional Mexican folk song (La Cucaracha) — public domain.",
  bpm: 104,
  meter: { numerator: 4, denominator: 4 },
  bars: 4,
  tag: "world",
  grooveId: "cumbia",
  harmony: {
    tonic: 0, // C major
    modeId: "western.ionian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "C", lenBeats: 8 },
      { beat: 8, symbol: "G7", lenBeats: 4 },
      { beat: 12, symbol: "C", lenBeats: 4 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Trumpet",
      presetId: "trumpet",
      notes: [
        // "La cu-ca-ra-cha, la cu-ca-ra-cha"
        { beat: 0, pitch: 60, len: 0.5 }, // C4 "La"
        { beat: 0.5, pitch: 60, len: 0.5 }, // C4 "cu-"
        { beat: 1, pitch: 60, len: 0.5 }, // C4 "ca-"
        { beat: 1.5, pitch: 65, len: 0.5 }, // F4 "ra-"
        { beat: 2, pitch: 69, len: 1 }, // A4 "cha"
        { beat: 4, pitch: 60, len: 0.5 }, // C4 "la"
        { beat: 4.5, pitch: 60, len: 0.5 }, // C4 "cu-"
        { beat: 5, pitch: 60, len: 0.5 }, // C4 "ca-"
        { beat: 5.5, pitch: 65, len: 0.5 }, // F4 "ra-"
        { beat: 6, pitch: 69, len: 1 }, // A4 "cha"
        // "ya no puede caminar"
        { beat: 8, pitch: 69, len: 0.5 }, // A4
        { beat: 8.5, pitch: 67, len: 0.5 }, // G4
        { beat: 9, pitch: 65, len: 0.5 }, // F4
        { beat: 9.5, pitch: 64, len: 0.5 }, // E4
        { beat: 10, pitch: 62, len: 1 }, // D4
        { beat: 12, pitch: 62, len: 0.5 }, // D4
        { beat: 12.5, pitch: 64, len: 0.5 }, // E4
        { beat: 13, pitch: 65, len: 0.5 }, // F4
        { beat: 13.5, pitch: 62, len: 0.5 }, // D4
        { beat: 14, pitch: 60, len: 2 }, // C4 resolve
      ],
    },
    {
      role: "bass",
      name: "Upright Bass",
      presetId: "upright-bass",
      notes: [
        // cumbia: root on 1, fifth on 3
        { beat: 0, pitch: 36, len: 1 }, // C2
        { beat: 2, pitch: 43, len: 1 }, // G2
        { beat: 4, pitch: 36, len: 1 }, // C2
        { beat: 6, pitch: 43, len: 1 }, // G2
        { beat: 8, pitch: 31, len: 1 }, // G1 (G7)
        { beat: 10, pitch: 38, len: 1 }, // D2
        { beat: 12, pitch: 36, len: 1 }, // C2
        { beat: 14, pitch: 43, len: 1 }, // G2
      ],
    },
    {
      role: "drums",
      name: "Afro-Cuban Kit",
      kitId: "afro-cuban",
      grid: 16,
      notes: [
        // straight cumbia pulse: kick on downbeats, conga & clap accents
        { beat: 0, role: "kick" }, { beat: 2, role: "kick" },
        { beat: 4, role: "kick" }, { beat: 6, role: "kick" },
        { beat: 8, role: "kick" }, { beat: 10, role: "kick" },
        { beat: 12, role: "kick" }, { beat: 14, role: "kick" },
        // conga tumbao-ish offbeats
        { beat: 1.5, role: "conga" }, { beat: 3.5, role: "conga" },
        { beat: 5.5, role: "conga" }, { beat: 7.5, role: "conga" },
        { beat: 9.5, role: "conga" }, { beat: 11.5, role: "conga" },
        { beat: 13.5, role: "conga" }, { beat: 15.5, role: "conga" },
        // claps on the backbeat
        { beat: 1, role: "clap" }, { beat: 3, role: "clap" },
        { beat: 5, role: "clap" }, { beat: 7, role: "clap" },
        { beat: 9, role: "clap" }, { beat: 11, role: "clap" },
        { beat: 13, role: "clap" }, { beat: 15, role: "clap" },
      ],
    },
  ],
}

/**
 * "Cielito Lindo" — Quirino Mejía Fernández, 1882 (public domain). The "Ay, ay,
 * ay, ay" chorus over a lilting 3/4 waltz with a clear oom-pah-pah bass.
 */
const cielitoLindo: DemoSongSpec = {
  id: "cielito-lindo",
  name: "Cielito Lindo",
  blurb: "The beloved \"Ay, ay, ay, ay\" chorus — a warm Mexican waltz in 3/4.",
  source: "Quirino Mejía Fernández, \"Cielito Lindo\" (1882) — public domain.",
  bpm: 150,
  meter: { numerator: 3, denominator: 4 },
  bars: 8,
  tag: "world",
  grooveId: "waltz",
  harmony: {
    tonic: 9, // A major
    modeId: "western.ionian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "A", lenBeats: 6 },
      { beat: 6, symbol: "E7", lenBeats: 6 },
      { beat: 12, symbol: "E7", lenBeats: 6 },
      { beat: 18, symbol: "A", lenBeats: 6 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Trumpet",
      presetId: "trumpet",
      notes: [
        // "Ay,    ay,    ay,    ay,    can-ta y no llo-res"
        { beat: 0, pitch: 73, len: 2 }, // C#5 "Ay"
        { beat: 2, pitch: 73, len: 1 }, // C#5
        { beat: 3, pitch: 76, len: 2 }, // E5 "ay"
        { beat: 5, pitch: 73, len: 1 }, // C#5
        { beat: 6, pitch: 72, len: 2 }, // C5? -> B/A: use 71 B4
        { beat: 8, pitch: 71, len: 1 }, // B4 "ay"
        { beat: 9, pitch: 73, len: 3 }, // C#5 "ay"
        // "canta y no llores"
        { beat: 12, pitch: 71, len: 1 }, // B4
        { beat: 13, pitch: 71, len: 1 }, // B4
        { beat: 14, pitch: 73, len: 1 }, // C#5
        { beat: 15, pitch: 74, len: 1 }, // D5
        { beat: 16, pitch: 73, len: 1 }, // C#5
        { beat: 17, pitch: 71, len: 1 }, // B4
        { beat: 18, pitch: 69, len: 3 }, // A4 resolve
        { beat: 21, pitch: 69, len: 3 }, // A4
      ],
    },
    {
      role: "mid",
      name: "Marimba",
      presetId: "marimba",
      volume: 0.55,
      notes: [
        // oom-pah-pah chords: root then upper voices on 2 & 3
        { beat: 0, pitch: 57, len: 1 }, // A3
        { beat: 1, pitch: 61, len: 1 }, // C#4
        { beat: 2, pitch: 64, len: 1 }, // E4
        { beat: 3, pitch: 57, len: 1 }, // A3
        { beat: 4, pitch: 61, len: 1 }, // C#4
        { beat: 5, pitch: 64, len: 1 }, // E4
        { beat: 6, pitch: 59, len: 1 }, // B3 (E7)
        { beat: 7, pitch: 64, len: 1 }, // E4
        { beat: 8, pitch: 68, len: 1 }, // G#4
        { beat: 9, pitch: 59, len: 1 }, // B3
        { beat: 10, pitch: 64, len: 1 }, // E4
        { beat: 11, pitch: 68, len: 1 }, // G#4
        { beat: 12, pitch: 59, len: 1 }, // B3
        { beat: 13, pitch: 64, len: 1 }, // E4
        { beat: 14, pitch: 68, len: 1 }, // G#4
        { beat: 15, pitch: 59, len: 1 }, // B3
        { beat: 16, pitch: 64, len: 1 }, // E4
        { beat: 17, pitch: 68, len: 1 }, // G#4
        { beat: 18, pitch: 57, len: 1 }, // A3
        { beat: 19, pitch: 61, len: 1 }, // C#4
        { beat: 20, pitch: 64, len: 1 }, // E4
        { beat: 21, pitch: 57, len: 1 }, // A3
        { beat: 22, pitch: 61, len: 1 }, // C#4
        { beat: 23, pitch: 64, len: 1 }, // E4
      ],
    },
    {
      role: "bass",
      name: "Upright Bass",
      presetId: "upright-bass",
      notes: [
        // waltz oom on beat 1 of each bar
        { beat: 0, pitch: 33, len: 1 }, // A1
        { beat: 3, pitch: 33, len: 1 }, // A1
        { beat: 6, pitch: 28, len: 1 }, // E1 (E7)
        { beat: 9, pitch: 28, len: 1 }, // E1
        { beat: 12, pitch: 28, len: 1 }, // E1
        { beat: 15, pitch: 28, len: 1 }, // E1
        { beat: 18, pitch: 33, len: 1 }, // A1
        { beat: 21, pitch: 33, len: 1 }, // A1
      ],
    },
  ],
}

/**
 * "Korobeiniki" — traditional Russian folk song (the "Tetris theme"), in
 * E harmonic minor, fast and driving with a four-on-the-floor village stomp.
 */
const korobeiniki: DemoSongSpec = {
  id: "korobeiniki",
  name: "Korobeiniki",
  blurb: "The bustling Russian peddlers' dance — harmonic minor, fast and relentless.",
  source: "Traditional Russian folk song (Korobeiniki) — public domain.",
  bpm: 150,
  meter: { numerator: 4, denominator: 4 },
  bars: 4,
  tag: "world",
  grooveId: "tarantella",
  harmony: {
    tonic: 4, // E harmonic minor (E F# G A B C D#)
    modeId: "western.harmonicMinor",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "Em", lenBeats: 4 },
      { beat: 4, symbol: "B7", lenBeats: 4 },
      { beat: 8, symbol: "Em", lenBeats: 4 },
      { beat: 12, symbol: "B7", lenBeats: 4 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Balalaika-ish Pluck",
      presetId: "synth-pluck",
      notes: [
        // E5 B4 C5 D5 | C5 B4 A4 A4 | C5 E5 D5 C5 | B4 ...
        { beat: 0, pitch: 76, len: 1 }, // E5
        { beat: 1, pitch: 71, len: 0.5 }, // B4
        { beat: 1.5, pitch: 72, len: 0.5 }, // C5
        { beat: 2, pitch: 74, len: 1 }, // D5
        { beat: 3, pitch: 72, len: 0.5 }, // C5
        { beat: 3.5, pitch: 71, len: 0.5 }, // B4
        { beat: 4, pitch: 69, len: 1 }, // A4
        { beat: 5, pitch: 69, len: 0.5 }, // A4
        { beat: 5.5, pitch: 72, len: 0.5 }, // C5
        { beat: 6, pitch: 76, len: 1 }, // E5
        { beat: 7, pitch: 74, len: 0.5 }, // D5
        { beat: 7.5, pitch: 72, len: 0.5 }, // C5
        { beat: 8, pitch: 71, len: 1.5 }, // B4
        { beat: 9.5, pitch: 72, len: 0.5 }, // C5
        { beat: 10, pitch: 74, len: 1 }, // D5
        { beat: 11, pitch: 76, len: 1 }, // E5
        { beat: 12, pitch: 72, len: 1 }, // C5
        { beat: 13, pitch: 69, len: 1 }, // A4
        { beat: 14, pitch: 69, len: 2 }, // A4 resolve
      ],
    },
    {
      role: "bass",
      name: "Reese Bass",
      presetId: "reese-bass",
      notes: [
        { beat: 0, pitch: 40, len: 1 }, // E2
        { beat: 2, pitch: 47, len: 1 }, // B2
        { beat: 4, pitch: 47, len: 1 }, // B2 (B7)
        { beat: 6, pitch: 42, len: 1 }, // F#2
        { beat: 8, pitch: 40, len: 1 }, // E2
        { beat: 10, pitch: 47, len: 1 }, // B2
        { beat: 12, pitch: 47, len: 1 }, // B2
        { beat: 14, pitch: 40, len: 2 }, // E2
      ],
    },
    {
      role: "drums",
      name: "Rock Kit",
      kitId: "rock",
      grid: 16,
      notes: [
        // driving four-on-the-floor stomp with backbeat claps
        { beat: 0, role: "kick" }, { beat: 1, role: "snare" },
        { beat: 2, role: "kick" }, { beat: 3, role: "snare" },
        { beat: 4, role: "kick" }, { beat: 5, role: "snare" },
        { beat: 6, role: "kick" }, { beat: 7, role: "snare" },
        { beat: 8, role: "kick" }, { beat: 9, role: "snare" },
        { beat: 10, role: "kick" }, { beat: 11, role: "snare" },
        { beat: 12, role: "kick" }, { beat: 13, role: "snare" },
        { beat: 14, role: "kick" }, { beat: 15, role: "snare" },
        // closed hats on every 8th
        { beat: 0, role: "closedHat" }, { beat: 0.5, role: "closedHat" },
        { beat: 1, role: "closedHat" }, { beat: 1.5, role: "closedHat" },
        { beat: 2, role: "closedHat" }, { beat: 2.5, role: "closedHat" },
        { beat: 3, role: "closedHat" }, { beat: 3.5, role: "closedHat" },
      ],
    },
  ],
}

/**
 * "Son Montuno" — an ORIGINAL montuno riff (the melody is original) laid over
 * the traditional public-domain 2-3 son clave form. C Mixolydian piano guajeo,
 * tumbao bass and a clave + conga + cowbell groove — the heart of salsa/son.
 */
const sonMontuno: DemoSongSpec = {
  id: "son-montuno",
  name: "Son Montuno",
  blurb: "An original montuno guajeo over a 2-3 son clave — tumbao bass, congas and cowbell.",
  source: "Original riff (CC0) over the traditional 2-3 son clave — clave form is public domain.",
  bpm: 96,
  meter: { numerator: 4, denominator: 4 },
  bars: 2,
  tag: "world",
  grooveId: "son-clave-2-3",
  harmony: {
    tonic: 0, // C — vamp between C7 and F (mixolydian color)
    modeId: "western.mixolydian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "C7", lenBeats: 4 },
      { beat: 4, symbol: "F", lenBeats: 4 },
    ],
  },
  tracks: [
    {
      role: "mid",
      name: "Montuno Piano",
      presetId: "electric-piano",
      notes: [
        // syncopated guajeo: C7 voicing then F voicing, anticipating beats
        { beat: 0, pitch: 64, len: 0.5 }, // E4
        { beat: 0.5, pitch: 67, len: 0.5 }, // G4
        { beat: 1, pitch: 72, len: 0.5 }, // C5
        { beat: 1.5, pitch: 70, len: 0.5 }, // Bb4
        { beat: 2.5, pitch: 67, len: 0.5 }, // G4
        { beat: 3, pitch: 64, len: 0.5 }, // E4
        { beat: 3.5, pitch: 60, len: 0.5 }, // C4 (anticipates F)
        { beat: 4, pitch: 65, len: 0.5 }, // F4
        { beat: 4.5, pitch: 69, len: 0.5 }, // A4
        { beat: 5, pitch: 72, len: 0.5 }, // C5
        { beat: 5.5, pitch: 69, len: 0.5 }, // A4
        { beat: 6.5, pitch: 65, len: 0.5 }, // F4
        { beat: 7, pitch: 64, len: 0.5 }, // E4
        { beat: 7.5, pitch: 64, len: 0.5 }, // E4 (anticipates C7)
      ],
    },
    {
      role: "bass",
      name: "Tumbao Bass",
      presetId: "finger-bass",
      notes: [
        // tumbao: rest on 1, accent the "and-of-2" and beat 4
        { beat: 1.5, pitch: 36, len: 0.5 }, // C2 (and of 2)
        { beat: 3, pitch: 43, len: 1 }, // G2 (beat 4)
        { beat: 5.5, pitch: 41, len: 0.5 }, // F2 (and of 2)
        { beat: 7, pitch: 36, len: 1 }, // C2 (beat 4, anticipates)
      ],
    },
    {
      role: "drums",
      name: "Afro-Cuban Kit",
      kitId: "afro-cuban",
      grid: 16,
      notes: [
        // 2-3 son clave on rim (clave): bar's "2 side" then "3 side"
        // 2-side: beats 2 and 3
        { beat: 1, role: "rim" }, { beat: 2, role: "rim" },
        // 3-side: beats 5 (1 of bar2), 6.5 (and of 2), 8? -> within 2-bar: 4, 5.5, 6.5? keep canonical 2-3 across 8 beats:
        { beat: 4, role: "rim" }, { beat: 5.5, role: "rim" }, { beat: 6.5, role: "rim" },
        // conga tumbao (open tones on the "and of 4" + slaps)
        { beat: 1.5, role: "conga" }, { beat: 3, role: "conga" }, { beat: 3.5, role: "conga" },
        { beat: 5.5, role: "conga" }, { beat: 7, role: "conga" }, { beat: 7.5, role: "conga" },
        // cowbell drives quarter notes (campana)
        { beat: 0, role: "cowbell" }, { beat: 1, role: "cowbell" },
        { beat: 2, role: "cowbell" }, { beat: 3, role: "cowbell" },
        { beat: 4, role: "cowbell" }, { beat: 5, role: "cowbell" },
        { beat: 6, role: "cowbell" }, { beat: 7, role: "cowbell" },
        // kick marks beat 1 of each bar
        { beat: 0, role: "kick" }, { beat: 4, role: "kick" },
      ],
    },
  ],
}

export const WORLD_DEMOS: DemoSongSpec[] = [
  havaNagila,
  laCucaracha,
  cielitoLindo,
  korobeiniki,
  sonMontuno,
]
