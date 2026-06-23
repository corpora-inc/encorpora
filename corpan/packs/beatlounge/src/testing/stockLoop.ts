/**
 * beatlounge — SHARED TEST FIXTURE: the classic "stock loop".
 *
 * The default doc now boots EMPTY (no notes) so "new" is a calm blank slate.
 * Many unit tests, though, need a doc that already has musical content (a kick
 * on the beats, a backbeat snare, eighth hats, a C–E–G–C synth riff) — exactly
 * the old default. Rather than re-seed that content inline in a dozen test
 * files, they import these helpers. This keeps the fixture in ONE place and
 * the tests focused on behavior, not setup.
 *
 * NOT part of the app bundle — imported only by *.test.ts (and tree-shaken from
 * any accidental app import). The file name has no `.test.`/`.spec.` segment so
 * the runner never collects it as a suite.
 */

import { createDefaultDoc, DRUM_PITCH, type BeatloungeDoc, type InstrumentTrack } from "../model/document"
import { reduce } from "../model/reduce"
import { PPQ } from "../model/timing"

/** The classic drum pattern: four-on-the-floor kick, backbeat snare, eighth hats. */
export const stockDrumNotes = () => {
  const q = PPQ
  const e = PPQ / 2
  return [
    ...[0, 1, 2, 3].map((i) => ({ tick: i * q, duration: PPQ / 8, pitch: DRUM_PITCH.kick, velocity: 0.9 })),
    { tick: q, duration: PPQ / 8, pitch: DRUM_PITCH.snare, velocity: 0.85 },
    { tick: 3 * q, duration: PPQ / 8, pitch: DRUM_PITCH.snare, velocity: 0.85 },
    ...Array.from({ length: 8 }, (_, i) => ({ tick: i * e, duration: PPQ / 8, pitch: DRUM_PITCH.hat, velocity: 0.5 })),
  ]
}

/** The classic synth riff: a C–E–G–C major arpeggio, one note per beat. */
export const stockRiffNotes = () =>
  [60, 64, 67, 72].map((pitch, i) => ({ tick: i * PPQ, duration: PPQ, pitch, velocity: 0.7 }))

/** Seed the stock drum pattern onto `doc`'s drum track (tracks[0]). */
export const withStockDrums = (doc: BeatloungeDoc): BeatloungeDoc =>
  reduce(doc, { t: "setNotes", trackId: (doc.tracks[0] as InstrumentTrack).id, notes: stockDrumNotes() })

/** Seed the stock synth riff onto `doc`'s synth track (tracks[1]). */
export const withStockRiff = (doc: BeatloungeDoc): BeatloungeDoc =>
  reduce(doc, { t: "setNotes", trackId: (doc.tracks[1] as InstrumentTrack).id, notes: stockRiffNotes() })

/**
 * The old "musically-alive" default: the empty boot doc with the classic drum
 * loop + synth riff seeded on. Use wherever a test needs pre-existing content.
 */
export const stockLoopDoc = (now = 0): BeatloungeDoc => withStockRiff(withStockDrums(createDefaultDoc(now)))
