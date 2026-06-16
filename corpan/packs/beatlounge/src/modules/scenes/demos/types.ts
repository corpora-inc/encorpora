/**
 * beatlounge — DEMO SONG schema (authorable, plain JSON).
 *
 * A `DemoSongSpec` is a beat-addressed, human-authorable description of a
 * starter song the app ships under "Start fresh → Demos". The compiler
 * (./compile) turns it into a `SceneSnapshot` the scenes controller loads as one
 * undoable step. Notes are expressed in BEATS (not ticks) so they read like
 * sheet music and are trivial for a person — or a research subagent — to write.
 *
 * Everything is plain JSON: no functions, no class instances. Ids in the corpus
 * (presetId / kitId / modeId / grooveId) are validated at compile time so a
 * typo is a loud failure in tests, never a silent wrong sound.
 *
 * SOURCING: only ship demos built from public-domain or permissively-licensed
 * (CC-BY / CC0) material. Record provenance in `source` for every demo.
 */

import type { VoiceRole } from "../../../kits/types"
import type { GridDenominator } from "../../../model/timing"

/** One beat-addressed note. `pitch` is MIDI for melodic voices; for drum tracks
 *  give `role` (preferred) or a GM-ish `pitch`. */
export interface DemoNote {
  /** Start, in beats from the loop origin (0-based, may be fractional). */
  beat: number
  /** Length in beats (may be fractional). Defaults to a quarter-beat for drums. */
  len?: number
  /** MIDI pitch (melodic). Required unless a drum `role` is given. */
  pitch?: number
  /** Drum voice role (drum tracks) — resolved to a pitch via the kit map. */
  role?: VoiceRole
  /** Velocity 0..1 (default 0.85). */
  vel?: number
}

export type DemoVoiceRole = "drums" | "bass" | "mid" | "lead"

export interface DemoTrackSpec {
  /** The voice this track plays — drives default color + which id field applies. */
  role: DemoVoiceRole
  /** Mixer/display name. */
  name: string
  /** Instrument preset id (melodic tracks). Ignored for `drums`. */
  presetId?: string
  /** Drum kit id (the `drums` track). Ignored for melodic tracks. */
  kitId?: string
  /** Step grid denominator (default 16). */
  grid?: GridDenominator
  /** Track volume 0..1 (default 0.8). */
  volume?: number
  notes: DemoNote[]
}

export interface DemoChord {
  /** Start, in beats from the loop origin. */
  beat: number
  /** Chord symbol the resolver parses, e.g. "C", "Am7", "G/B". */
  symbol: string
  /** Length in beats (default: until the next chord / loop end). */
  lenBeats?: number
}

export interface DemoHarmony {
  /** Tonic pitch class 0..11 (C = 0). */
  tonic: number
  /** Mode id from the mode corpus, e.g. "western.ionian", "western.aeolian". */
  modeId: string
  /** "modal" (scale only) or "chordal" (a progression). Inferred from `chords`. */
  mode?: "modal" | "chordal"
  /** Optional chord progression (makes the song chordal). */
  chords?: DemoChord[]
}

export interface DemoSongSpec {
  /** Stable, kebab-case unique id, e.g. "scarborough-fair". */
  id: string
  /** Display name (English; localized separately). */
  name: string
  /** One-line description a learner reads. */
  blurb: string
  /** Provenance — public-domain / CC attribution. REQUIRED. */
  source: string
  /** Tempo in BPM. */
  bpm: number
  /** Time signature. */
  meter: { numerator: number; denominator: number }
  /** Loop length in bars. */
  bars: number
  harmony: DemoHarmony
  /** The world groove the +/− dial starts on (rhythm corpus id), optional. */
  grooveId?: string
  /** A coarse style/family tag for the picker (e.g. "folk", "lofi", "latin"). */
  tag?: string
  tracks: DemoTrackSpec[]
}
