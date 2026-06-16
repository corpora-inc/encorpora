/**
 * beatlounge — the shipped DEMO SONG catalog.
 *
 * Hand-authored / research-sourced starter songs, all built from public-domain
 * or permissively-licensed material (provenance in each `source`). The compiler
 * (./compile) validates every id at test time, so this list is always loadable.
 *
 * Add demos here (or import them from ./songs/* and spread them in). Keep them
 * SHORT (a loop or two) — a demo is a starting point, not a finished track.
 */

import type { DemoSongSpec } from "./types"
import { FOLK_DEMOS } from "./songs/folk"
import { CLASSICAL_DEMOS } from "./songs/classical"
import { BLUESJAZZ_DEMOS } from "./songs/bluesjazz"
import { WORLD_DEMOS } from "./songs/world"

/** Beethoven's "Ode to Joy" theme — universally known, public domain. */
const odeToJoy: DemoSongSpec = {
  id: "ode-to-joy",
  name: "Ode to Joy",
  blurb: "Beethoven's famous theme — a gentle, stepwise major melody to build on.",
  source: "Ludwig van Beethoven, Symphony No. 9 (1824) — public domain.",
  bpm: 100,
  meter: { numerator: 4, denominator: 4 },
  bars: 4,
  tag: "classical",
  harmony: {
    tonic: 0, // C
    modeId: "western.ionian",
    mode: "chordal",
    chords: [
      { beat: 0, symbol: "C", lenBeats: 8 },
      { beat: 8, symbol: "G", lenBeats: 4 },
      { beat: 12, symbol: "C", lenBeats: 4 },
    ],
  },
  tracks: [
    {
      role: "lead",
      name: "Grand Piano",
      presetId: "grand-piano",
      notes: [
        { beat: 0, pitch: 64 }, { beat: 1, pitch: 64 }, { beat: 2, pitch: 65 }, { beat: 3, pitch: 67 },
        { beat: 4, pitch: 67 }, { beat: 5, pitch: 65 }, { beat: 6, pitch: 64 }, { beat: 7, pitch: 62 },
        { beat: 8, pitch: 60 }, { beat: 9, pitch: 60 }, { beat: 10, pitch: 62 }, { beat: 11, pitch: 64 },
        { beat: 12, pitch: 64, len: 1.5 }, { beat: 13.5, pitch: 62, len: 0.5 }, { beat: 14, pitch: 62, len: 2 },
      ],
    },
    {
      role: "bass",
      name: "Upright Bass",
      presetId: "upright-bass",
      notes: [
        { beat: 0, pitch: 36, len: 4 },
        { beat: 4, pitch: 36, len: 4 },
        { beat: 8, pitch: 43, len: 4 },
        { beat: 12, pitch: 36, len: 4 },
      ],
    },
  ],
}

/** The shipped catalog — the Ode-to-Joy seed plus the research-sourced sets,
 *  grouped roughly classical → folk → blues/jazz → world. The compile test
 *  validates every entry, so a bad id here fails CI, never ships silently. */
export const DEMO_SPECS: readonly DemoSongSpec[] = [
  odeToJoy,
  ...CLASSICAL_DEMOS,
  ...FOLK_DEMOS,
  ...BLUESJAZZ_DEMOS,
  ...WORLD_DEMOS,
]
