/**
 * beatlounge — the JAM composer: the "never-ending piano player".
 *
 * Given a parsed Progression (or a key+mode+template), it generates MUSICAL,
 * DIRECTED, non-repetitive note material — not a random-note spray. It emits
 * `Omit<NoteEvent,"id">[]` ready for a `setNotes` command on the synth track.
 *
 * HOW IT STAYS MUSICAL (the strategy):
 *
 *  1. Harmony-locked. Every strong-beat melody note is a CHORD TONE of the
 *     chord sounding at that beat; weak-beat notes may be scale passing/neighbor
 *     tones drawn from the chord's fitting scale (harmony.QUALITY_SCALE). So the
 *     line always spells the changes and resolves on the beat.
 *
 *  2. Voice-leading. Comp/arp voices move by the SMALLEST leap between chords
 *     (harmony.nearestPcTo), and the melody biases toward small steps with
 *     occasional leaps — so it sounds like one player, not arpeggio confetti.
 *
 *  3. Motif + variation (anti-repetition). A short rhythmic+contour MOTIF is
 *     generated once from the seed, then each phrase applies a deterministic
 *     TRANSFORM (transpose-in-scale, invert, retrograde, rhythmic displacement,
 *     ornament) chosen by the seed — so material recurs RECOGNIZABLY but never
 *     identically. A phrase-level CONTOUR arc (rise → peak → fall) shapes
 *     register across the whole jam so it has direction, not a flat ramble.
 *
 *  4. Density / register / feel are knobs. "arp" / "chords" / "melody" /
 *     "bass" pick a generator; density scales note count; register sets octave.
 *
 *  5. Determinism. Everything flows from one integer seed via mulberry32, so the
 *     same (progression, seed, options) always yields the same notes — "re-roll"
 *     = new seed; "evolve" = seed+1 PLUS a nudged motif (a small, related step,
 *     not a fresh roll), giving the "keep jamming, keep changing" feel.
 *
 *  The "keep jamming" seam: `jam()` is pure over (progression, seed, opts). A
 *  host loop can call it every N bars with an evolving seed to stream endless,
 *  related material onto the track — `evolveSeed`/`jamCycle` expose that seam.
 */

import type { NoteEvent } from "../model/document"
import { PPQ } from "../model/timing"
import type { Chord, ScaleName } from "./harmony"
import {
  SCALES,
  chordMidiTones,
  mod,
  nearestPcTo,
  snapToScale,
  toPc,
} from "./harmony"
import type { Progression } from "./progression"

export type JamFeel = "arp" | "chords" | "melody" | "bass"

export interface JamOptions {
  /** Generator shape. */
  feel: JamFeel
  /** Notes-per-beat-ish density, 0..1. Maps to subdivision + fill. */
  density: number
  /** Centre MIDI of the register the part sits in (e.g. 60 = C4). */
  register: number
  /** Deterministic seed; same seed ⇒ same notes. */
  seed: number
  /** Default note velocity centre, 0..1. */
  velocity?: number
}

export const defaultJamOptions = (): JamOptions => ({
  feel: "melody",
  density: 0.5,
  register: 60,
  seed: 1,
  velocity: 0.7,
})

/** mulberry32 — the same deterministic stream shape used across the pack. */
const makeRng = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Evolve a seed by a small, related step (NOT a fresh random roll). */
export const evolveSeed = (seed: number): number => (seed + 0x9e3779b1) >>> 0

// ----------------------------------------------------------------- motif
interface MotifCell {
  /** Subdivision offset within a beat (0 = downbeat), in 1/4-beat units (0..3). */
  off: number
  /** Scale-degree contour relative to the phrase anchor (signed steps). */
  contour: number
  /** Note length in 1/4-beat units. */
  len: number
  /** Velocity accent 0..1 (relative). */
  accent: number
}

/** A motif is a short ordered list of cells spanning ~1–2 beats. */
type Motif = MotifCell[]

/** Generate a singable motif from the seed: small contour steps + a syncopation. */
const makeMotif = (rng: () => number, density: number): Motif => {
  // 3..5 notes depending on density.
  const n = 3 + Math.floor(rng() * (density > 0.6 ? 3 : 2))
  const cells: Motif = []
  let off = 0
  let contour = 0
  for (let i = 0; i < n; i++) {
    // Mostly stepwise motion (-2..+2), occasional leap.
    const leap = rng() > 0.82
    const stepAmt = leap ? (rng() > 0.5 ? 3 : -3) : Math.round(rng() * 2 - 1)
    contour += stepAmt
    const len = rng() > 0.7 ? 2 : 1
    cells.push({
      off: off % 4,
      contour,
      len,
      accent: i === 0 ? 1 : 0.6 + rng() * 0.3,
    })
    // Advance by 1 or 2 sixteenths (in quarter-beat units) for rhythmic life.
    off += len
  }
  return cells
}

/**
 * Phrase transforms — applied per phrase so material recurs but never identical.
 * Each is a pure function (Motif, salt) → Motif.
 */
const TRANSFORMS: Array<(m: Motif, salt: number) => Motif> = [
  // identity (the motif returns home — important for coherence)
  (m) => m,
  // transpose in scale degrees (up or down by 1..2)
  (m, salt) => m.map((c) => ({ ...c, contour: c.contour + ((salt % 2) === 0 ? 2 : -1) })),
  // invert the contour around the anchor
  (m) => m.map((c) => ({ ...c, contour: -c.contour })),
  // retrograde (play the contour backwards)
  (m) => [...m].reverse().map((c, i, arr) => ({ ...c, off: arr[i].off })),
  // rhythmic displacement (push the whole motif a sixteenth later)
  (m) => m.map((c) => ({ ...c, off: (c.off + 1) % 4 })),
  // ornament (lift the accents, slightly tighter)
  (m) => m.map((c) => ({ ...c, accent: Math.min(1, c.accent + 0.2) })),
]

// ----------------------------------------------------------------- helpers
const QUARTER = PPQ // one beat
const SIXTEENTH = PPQ / 4

const clampMidi = (m: number): number => Math.max(24, Math.min(96, Math.round(m)))
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

/** Walk `steps` scale degrees from a MIDI pitch, staying in `tonic`/`scale`. */
const walkDegrees = (
  midi: number,
  steps: number,
  tonic: number,
  scale: ScaleName
): number => {
  if (steps === 0) return snapToScale(midi, toPc(tonic), scale)
  const degs = SCALES[scale]
  // Find the current degree index nearest to `midi`.
  const pc = mod(midi - tonic, 12)
  let idx = degs.findIndex((d) => d === pc)
  if (idx === -1) {
    // Snap to nearest degree first.
    let best = 0
    let bestD = 99
    for (let i = 0; i < degs.length; i++) {
      const d = Math.abs(degs[i] - pc)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    idx = best
  }
  const octBase = midi - ((midi - tonic - degs[idx]) % 12)
  let oct = Math.floor((octBase - tonic) / 12)
  let newIdx = idx + steps
  while (newIdx < 0) {
    newIdx += degs.length
    oct -= 1
  }
  while (newIdx >= degs.length) {
    newIdx -= degs.length
    oct += 1
  }
  return tonic + oct * 12 + degs[newIdx]
}

/** The chord tones of `chord` as pitch classes near a register anchor. */
const chordToneSet = (chord: Chord): number[] => chord.tones.map((t) => toPc(chord.root + t))

// ----------------------------------------------------------------- generators

/**
 * MELODY — the headline jam. A motif phrased over the progression: strong beats
 * land on chord tones, weak beats fill with scale steps, and a long contour arc
 * (rise → peak ~2/3 through → fall) shapes register so the whole jam has a
 * narrative. Each phrase (one chord span) applies a seed-chosen transform.
 */
const genMelody = (prog: Progression, opts: JamOptions, rng: () => number): Omit<NoteEvent, "id">[] => {
  const notes: Omit<NoteEvent, "id">[] = []
  const baseMotif = makeMotif(rng, opts.density)
  const total = prog.totalBeats
  let prev = opts.register
  let phraseIdx = 0

  for (const tc of prog.chords) {
    const chord = tc.chord
    const tonic = chord.root
    const scale = chord.scale
    // Pick a phrase transform from the seed (recognizable recurrence).
    const transform = TRANSFORMS[Math.floor(rng() * TRANSFORMS.length)]
    const motif = transform(baseMotif, phraseIdx)

    // Contour arc across the WHOLE jam: register rises to a peak then falls.
    const t = total > 0 ? tc.startBeat / total : 0
    const arc = Math.sin(t * Math.PI) // 0..1..0
    const arcLift = Math.round(arc * 5) // up to ~a fourth of lift mid-jam

    // Anchor the phrase on a chord tone near the previous note + arc lift.
    const targetPc = chordToneSet(chord)[Math.floor(rng() * chordToneSet(chord).length)]
    let anchor = nearestPcTo(targetPc, prev + arcLift)
    anchor = clampMidi(anchor)

    // Lay the motif across this chord's beats. The motif loops to fill the span.
    const spanQuarters = tc.beats * 4 // in 1/4-beat units
    let cursor = 0
    let mi = 0
    while (cursor < spanQuarters) {
      const cell = motif[mi % motif.length]
      const beatPos = tc.startBeat * 4 + cursor // absolute 1/4-beat units
      const tick = Math.round(beatPos * SIXTEENTH)
      const isStrong = cursor % 4 === 0 // downbeat of each beat
      // Pitch: walk the contour from the anchor; strong beats snap to chord tone.
      let midi = walkDegrees(anchor, cell.contour, tonic, scale)
      if (isStrong) {
        // Resolve to the NEAREST chord tone (directed landing).
        const tones = chordToneSet(chord)
        let best = midi
        let bestD = 99
        for (const pc of tones) {
          const cand = nearestPcTo(pc, midi)
          const d = Math.abs(cand - midi)
          if (d < bestD) {
            bestD = d
            best = cand
          }
        }
        midi = best
      } else {
        midi = snapToScale(midi, toPc(tonic), scale)
      }
      midi = clampMidi(midi)
      const dur = Math.max(SIXTEENTH, cell.len * SIXTEENTH)
      // Density gate: thin the line when density is low (drop some weak cells).
      const keep = isStrong || rng() < 0.35 + opts.density * 0.6
      if (keep) {
        notes.push({
          tick,
          duration: Math.min(dur, tc.beats * QUARTER),
          pitch: midi,
          velocity: clamp01((opts.velocity ?? 0.7) * (0.7 + cell.accent * 0.4)),
        })
        prev = midi
      }
      cursor += Math.max(1, cell.len)
      mi++
    }
    phraseIdx++
  }
  return dedupe(notes)
}

/**
 * ARP — a directed arpeggio that follows the harmony. Each chord's tones are
 * arpeggiated up/down with a contour that voice-leads from the previous chord's
 * top voice, subdivided by density. Non-repetitive because the direction +
 * starting inversion rotate per chord.
 */
const genArp = (prog: Progression, opts: JamOptions, rng: () => number): Omit<NoteEvent, "id">[] => {
  const notes: Omit<NoteEvent, "id">[] = []
  // Subdivision: low density → 8ths, high → 16ths.
  const sub = opts.density > 0.55 ? SIXTEENTH : SIXTEENTH * 2
  for (const tc of prog.chords) {
    const chord = tc.chord
    const octaveRoot = nearestPcTo(chord.root, opts.register) // root near register
    const base = chordMidiTones(chord, octaveRoot) // ascending chord tones, one octave
    // Build a SMOOTH ladder spanning ~1.5 octaves: tones, then the next octave's
    // tones — strictly ascending, so consecutive steps are small thirds/fourths.
    const ladder = [...base, ...base.map((p) => p + 12)]
    // A bounce traversal (up then back down) gives a directed, non-jumpy contour.
    const path = [...ladder, ...[...ladder].reverse().slice(1, -1)]
    // Per-chord rotation of the start index → variation without big leaps.
    const startRot = Math.floor(rng() * base.length)
    const up = rng() > 0.4 // mostly ascending phrasing, sometimes descending
    const spanTicks = tc.beats * QUARTER
    let ti = startRot
    for (let pos = 0; pos < spanTicks; pos += sub) {
      const idx = up ? ti % path.length : (path.length - 1 - (ti % path.length))
      const pitch = clampMidi(path[idx])
      notes.push({
        tick: tc.startBeat * QUARTER + pos,
        duration: Math.round(sub * 0.9),
        pitch,
        velocity: clamp01((opts.velocity ?? 0.65) * (pos === 0 ? 1 : 0.78)),
      })
      ti++
    }
  }
  return dedupe(notes)
}

/**
 * CHORDS — block comping. Each chord sounds as a voiced stack on its downbeat
 * (plus a rhythmic push on busier densities), voice-led from the previous chord
 * so the top line moves smoothly. The harmonic backbone of the jam.
 */
const genChords = (prog: Progression, opts: JamOptions, rng: () => number): Omit<NoteEvent, "id">[] => {
  const notes: Omit<NoteEvent, "id">[] = []
  let prevVoicing: number[] | null = null
  for (const tc of prog.chords) {
    const chord = tc.chord
    const voicing = voiceLead(chord, prevVoicing, opts.register)
    prevVoicing = voicing
    const hits: number[] = [0]
    // On busier densities add an off-beat push (the "comp" feel).
    if (opts.density > 0.5 && tc.beats >= 2) hits.push(Math.floor(tc.beats / 2) * QUARTER + (rng() > 0.5 ? QUARTER / 2 : 0))
    for (const h of hits) {
      const dur = h === 0 ? tc.beats * QUARTER : Math.round(QUARTER * 0.8)
      for (const p of voicing) {
        notes.push({
          tick: tc.startBeat * QUARTER + h,
          duration: dur,
          pitch: clampMidi(p),
          velocity: clamp01((opts.velocity ?? 0.6) * (h === 0 ? 0.9 : 0.65)),
        })
      }
    }
  }
  return dedupe(notes)
}

/**
 * BASS — a walking/rooted bassline. Strong beats hit the root; weak beats
 * approach the NEXT chord's root via scale steps (a directed walk). One octave
 * below the register anchor.
 */
const genBass = (prog: Progression, opts: JamOptions, rng: () => number): Omit<NoteEvent, "id">[] => {
  const notes: Omit<NoteEvent, "id">[] = []
  const bassReg = opts.register - 24
  const chords = prog.chords
  for (let ci = 0; ci < chords.length; ci++) {
    const tc = chords[ci]
    const chord = tc.chord
    const next = chords[(ci + 1) % chords.length]
    const rootMidi = clampMidi(nearestPcTo(chord.root, bassReg))
    const nextRoot = clampMidi(nearestPcTo(next.chord.root, bassReg))
    const beats = tc.beats
    for (let b = 0; b < beats; b++) {
      const tick = (tc.startBeat + b) * QUARTER
      let pitch: number
      if (b === 0) {
        pitch = rootMidi
      } else if (b === beats - 1 && opts.density > 0.4) {
        // Approach the next root: chromatic/scale leading tone a step away.
        const dir = nextRoot >= rootMidi ? -1 : 1
        pitch = clampMidi(nextRoot + dir * (rng() > 0.5 ? 1 : 2))
      } else {
        // Fifth or scale step for movement.
        const tone = chord.tones[rng() > 0.5 ? Math.min(2, chord.tones.length - 1) : 0]
        pitch = clampMidi(nearestPcTo(toPc(chord.root + tone), rootMidi))
      }
      // On low density, only sound the downbeat.
      if (b !== 0 && opts.density < 0.3) continue
      notes.push({
        tick,
        duration: QUARTER,
        pitch,
        velocity: clamp01((opts.velocity ?? 0.75) * (b === 0 ? 1 : 0.8)),
      })
    }
  }
  return dedupe(notes)
}

/**
 * Voice-lead a chord against the previous voicing: each new voice takes the
 * octave of its pitch class nearest the matching previous voice (minimal motion).
 * Seeds a sensible mid-register voicing when there's no previous chord.
 */
const voiceLead = (chord: Chord, prev: number[] | null, register: number): number[] => {
  const pcs = chord.tones.map((t) => toPc(chord.root + t))
  if (!prev) {
    // Stack within an octave above the register root.
    const root = nearestPcTo(chord.root, register)
    return pcs.map((pc, i) => {
      const m = nearestPcTo(pc, root + i * 3)
      return m < root ? m + 12 : m
    })
  }
  // For each chord pc, place it near the previous voice at the same index.
  return pcs.map((pc, i) => {
    const anchor = prev[Math.min(i, prev.length - 1)]
    return nearestPcTo(pc, anchor)
  })
}

/** Drop duplicate (tick,pitch) notes, keep the louder; sort by tick. */
const dedupe = (notes: Omit<NoteEvent, "id">[]): Omit<NoteEvent, "id">[] => {
  const map = new Map<string, Omit<NoteEvent, "id">>()
  for (const n of notes) {
    const key = `${n.tick}:${n.pitch}`
    const cur = map.get(key)
    if (!cur || n.velocity > cur.velocity) map.set(key, n)
  }
  return [...map.values()].sort((a, b) => a.tick - b.tick || a.pitch - b.pitch)
}

// ----------------------------------------------------------------- public API

/**
 * THE JAM. Generate note material for a progression. Pure + deterministic over
 * (prog, opts.seed, opts). Returns notes ready for a `setNotes` command.
 */
export const jam = (prog: Progression, opts: JamOptions): Omit<NoteEvent, "id">[] => {
  if (prog.chords.length === 0) return []
  const rng = makeRng(opts.seed || 1)
  switch (opts.feel) {
    case "arp":
      return genArp(prog, opts, rng)
    case "chords":
      return genChords(prog, opts, rng)
    case "bass":
      return genBass(prog, opts, rng)
    case "melody":
    default:
      return genMelody(prog, opts, rng)
  }
}

/**
 * The loop length (in ticks) a progression occupies — so the caller can set the
 * track/song loop to match. One beat = one quarter = PPQ ticks.
 */
export const progressionTicks = (prog: Progression): number => prog.totalBeats * QUARTER

/**
 * The "keep jamming" seam: produce the NEXT cycle's notes from the current seed,
 * advancing it by a small related step (evolveSeed) so successive cycles are
 * varied but coherent. A host render loop calls this every N bars to stream an
 * endless, directed performance. Returns the notes AND the advanced seed.
 */
export const jamCycle = (
  prog: Progression,
  opts: JamOptions
): { notes: Omit<NoteEvent, "id">[]; nextSeed: number } => {
  const notes = jam(prog, opts)
  return { notes, nextSeed: evolveSeed(opts.seed) }
}
