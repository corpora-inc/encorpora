/**
 * beatlounge — the chord-progression NOTATION parser.
 *
 * The founder's grammar (comma = beat):
 *
 *   COMMAS ARE BEATS. A chord token sets the CURRENT chord; each comma that
 *   follows it sustains that chord for ONE beat. The token itself consumes no
 *   beat — the commas do.
 *
 *     "Dmin,,,,Gmin,,A7,,"  → Dmin (4 beats), Gmin (2), A7 (2)
 *     "D,,A,,D,,,,G,,,,"     → D (2), A (2), D (4), G (4)
 *
 * So a chord's duration = the number of commas that immediately follow it
 * before the next chord token.
 *
 * Forgiving nicety: a chord token with NO comma after it (e.g. space-separated
 * "C F G" shorthand) is given an implied 1 beat so it is never silent.
 *
 * Robust + forgiving extensions we add (without overfitting):
 *   - Whitespace and newlines are ignored (you can lay a song out in lines).
 *   - "|" bar lines are treated as whitespace separators (purely cosmetic).
 *   - A bare comma BEFORE any chord is a leading rest (silence) of that length.
 *   - A trailing comma run extends the last chord (matches the examples).
 *   - Tokens are chord symbols parsed by harmony.parseChord (very forgiving).
 *
 * Output is a TIMED chord list: each entry has the parsed chord, its start beat
 * and its duration in beats. This is the substrate the JAM composer reads.
 */

import type { Chord } from "./harmony"
import { parseChord } from "./harmony"

export interface TimedChord {
  chord: Chord
  /** Start position in beats from the progression's beat 0. */
  startBeat: number
  /** Duration in beats (>= 1). */
  beats: number
  /** The raw token that produced this chord (for echo/debug). */
  token: string
}

export interface Progression {
  chords: TimedChord[]
  /** Total length in beats (including any leading/trailing rests). */
  totalBeats: number
  /** Leading rest in beats before the first chord (0 if it starts on a chord). */
  leadRest: number
}

/**
 * Tokenize the notation into a flat list of "events": each is either a chord
 * symbol or a comma (one beat-tick). We split on commas but keep them, and
 * treat whitespace / bar lines as separators.
 */
const tokenize = (src: string): Array<{ kind: "chord"; text: string } | { kind: "comma" }> => {
  // Normalize bar lines + newlines to spaces; commas are significant.
  const cleaned = src.replace(/[|\n\r\t]+/g, " ")
  const out: Array<{ kind: "chord"; text: string } | { kind: "comma" }> = []
  let buf = ""
  const flush = () => {
    const t = buf.trim()
    if (t) out.push({ kind: "chord", text: t })
    buf = ""
  }
  for (const ch of cleaned) {
    if (ch === ",") {
      flush()
      out.push({ kind: "comma" })
    } else if (ch === " ") {
      flush()
    } else {
      buf += ch
    }
  }
  flush()
  return out
}

/**
 * Parse the progression notation into a TimedChord list.
 *
 * Algorithm: COMMAS ARE BEATS. A chord token opens a chord with ZERO beats and
 * becomes "current" (it consumes no beat itself). Each subsequent comma adds a
 * beat — to the current chord if one is open, else to a leading rest. A chord
 * token that is immediately followed by another chord (no comma) is given an
 * implied 1 beat so it is never silent. Empty input → empty progression.
 */
export const parseProgression = (src: string): Progression => {
  const events = tokenize(src)
  const chords: TimedChord[] = []
  let beatCursor = 0
  let leadRest = 0
  let current: TimedChord | null = null

  /** Give the open chord an implied beat if it received no commas. */
  const ensureMinBeat = () => {
    if (current && current.beats === 0) {
      current.beats = 1
      beatCursor += 1
    }
  }

  for (const ev of events) {
    if (ev.kind === "chord") {
      const chord = parseChord(ev.text)
      if (!chord) continue
      ensureMinBeat() // the previous chord had no commas → implied 1 beat
      current = { chord, startBeat: beatCursor, beats: 0, token: ev.text }
      chords.push(current)
    } else {
      // comma — a beat of the current chord (or a leading rest)
      if (current) {
        current.beats += 1
      } else {
        leadRest += 1
      }
      beatCursor += 1
    }
  }
  ensureMinBeat() // trailing chord with no commas → implied 1 beat

  return { chords, totalBeats: beatCursor, leadRest }
}

/**
 * The chord SOUNDING at a given beat (0-based) in a progression, or null if the
 * beat falls in a rest / past the end. Used by the composer to know "what
 * harmony is active right now".
 */
export const chordAtBeat = (prog: Progression, beat: number): TimedChord | null => {
  for (const c of prog.chords) {
    if (beat >= c.startBeat && beat < c.startBeat + c.beats) return c
  }
  return null
}

/**
 * Serialize a TimedChord list BACK to the notation (round-trips the duration
 * semantics). Used by the UI readout + to canonicalize edited progressions.
 * Under the comma-is-a-beat model, a chord of N beats renders as its symbol
 * followed by N commas.
 */
export const renderProgression = (prog: Progression): string => {
  const parts: string[] = []
  // Leading rest renders as a run of commas before the first chord.
  if (prog.leadRest > 0) parts.push(",".repeat(prog.leadRest))
  for (const c of prog.chords) {
    parts.push(c.token + ",".repeat(Math.max(1, c.beats)))
  }
  return parts.join("")
}

/**
 * Build a Progression from an explicit chord+beats list (the generator path:
 * roman-numeral templates produce these directly without going through text).
 */
export const progressionFromChords = (
  items: Array<{ chord: Chord; beats: number; token?: string }>,
  leadRest = 0
): Progression => {
  let cursor = leadRest
  const chords: TimedChord[] = items.map((it) => {
    const beats = Math.max(1, Math.round(it.beats))
    const tc: TimedChord = {
      chord: it.chord,
      startBeat: cursor,
      beats,
      token: it.token ?? it.chord.symbol,
    }
    cursor += beats
    return tc
  })
  return { chords, totalBeats: cursor, leadRest }
}
