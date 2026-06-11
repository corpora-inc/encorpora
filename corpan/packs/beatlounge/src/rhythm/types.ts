/**
 * beatlounge — the WORLD-RHYTHMS corpus schema (pure data types, no audio/React).
 *
 * A `Rhythm` is a plain-JSON description of a groove from somewhere in the world:
 * son clave, samba, reggaeton, a New Orleans second-line, an Indian teental…
 * It is authored as TEXT and is engine-agnostic — the operations engine
 * (./engine) turns it into command-bus inputs against a beatlounge drum track,
 * and the same data drives phrase placement (phrases fall on the groove's
 * onsets). Everything here serializes losslessly.
 *
 * KEY DESIGN CHOICES
 *  • A rhythm is addressed in *cells* on a fixed grid, NOT in ticks. The cell
 *    grid is `beats × stepsPerBeat` (e.g. 4 beats × 4 = 16 sixteenth cells for a
 *    one-bar 4/4 pattern; an Indian teental is 16 beats × 1 = 16 matra cells).
 *    The engine maps cells → ticks at apply time against the song's PPQ, so a
 *    pattern is independent of resolution and of the host's loop length.
 *  • Lanes are keyed by ROLE (a percussion voice name, e.g. "kick", "clave",
 *    "conga-lo"), never by MIDI pitch. The role→pitch mapping lives in ./roles
 *    so the corpus stays human-readable and the kit can change underneath it.
 *  • A lane's pattern is a sparse list of HITS (cell + optional velocity/accent/
 *    ghost/flam), so authoring a 16-cell clave is a handful of numbers, and a
 *    long Indian cycle stays compact.
 */

/** A percussion role — the *musical* voice name a lane plays. The concrete set
 *  and the role→DRUM_PITCH mapping live in ./roles (this is a string alias so
 *  the corpus data reads naturally and new roles don't churn this file). */
export type Role = string

/** Broad groove families, used for the style picker's grouping + randomize. */
export type RhythmFamily =
  | "afro-cuban"
  | "brazilian"
  | "caribbean"
  | "north-american"
  | "electronic"
  | "african"
  | "european"
  | "middle-eastern"
  | "indian"

/** One percussion strike inside a lane. `cell` is the 0-based grid index. */
export interface Hit {
  /** 0-based cell index within the pattern's grid (0 … cells-1). */
  cell: number
  /** 0..1 loudness. Absent ⇒ the lane's default accent (~0.85). */
  velocity?: number
  /** A backbone/downbeat accent (louder + flagged so vary/evolve protect it). */
  accent?: boolean
  /** A quiet "ghost" note (softer; the first thing vary/evolve may drop/add). */
  ghost?: boolean
  /** Subdivide this hit into N rapid strikes (a drum-roll / flam). 1 ⇒ single. */
  ratchet?: number
}

/** A single percussion voice's pattern across the rhythm's grid. */
export interface Lane {
  /** The percussion role this lane plays (mapped to a kit pitch by ./roles). */
  role: Role
  /** Sparse, cell-addressed hits (need not be sorted; the engine sorts). */
  hits: Hit[]
  /** Per-lane default velocity for hits that omit one (0..1). Default 0.85. */
  velocity?: number
  /** This lane carries the rhythm's SIGNATURE (e.g. the clave, the surdo, the
   *  tresillo). Vary/evolve preserve signature lanes' accented backbone so the
   *  groove stays recognisable. Absent ⇒ false (a colour/fill lane). */
  signature?: boolean
}

/**
 * A complete rhythm. The grid is `beats × stepsPerBeat` cells long.
 *
 * Non-4/4 + long cycles are first-class: `beats` is the cycle length in beats
 * (or matras for an Indian tala), and `timeSig` records how those beats group
 * for display. e.g. teental = { beats: 16, stepsPerBeat: 1, timeSig: "16/4" }.
 */
export interface Rhythm {
  /** Stable id, e.g. "son-clave-3-2", "samba", "teental". */
  id: string
  /** Display name, e.g. "Son Clave (3-2)". */
  name: string
  family: RhythmFamily
  /** Region / culture tag for the picker subtitle, e.g. "Cuba", "Bahia". */
  origin: string
  /** One-line description a learner reads. */
  blurb: string
  /** Cycle length in beats (or matras). 4 for a 4/4 bar; 16 for teental. */
  beats: number
  /** Cells per beat — the rhythm's resolution. 4 ⇒ sixteenths; 3 ⇒ triplets. */
  stepsPerBeat: number
  /** Human time-signature label for display, e.g. "4/4", "6/8", "16/4". */
  timeSig: string
  /** Suggested tempo (BPM) — a hint the UI may apply; never forced. */
  bpm?: number
  /** The percussion lanes (sparse, role-keyed). */
  lanes: Lane[]
  /** Optional free tags for search/affinity, e.g. ["clave","2-3","dance"]. */
  tags?: string[]
  /**
   * OPTIONAL per-rhythm SCATTER PROFILE override (see ./profile).
   *
   * The probabilistic SCATTER engine (the founder's "for row, for beat, maybe
   * place a hit" feature) needs, for every cell of the grid, how LIKELY a hit is
   * and how LOUD it should be when it fires. By default that profile is COMPUTED
   * from this rhythm's own lanes/accents/ghosts (an accented onset → high
   * probability + a loud velocity band; a ghost → lower; a rest → a low baseline)
   * so all 66 rhythms get a musical profile with zero hand-editing.
   *
   * Author this only to OVERRIDE the derived profile for a specific groove. It is
   * a sparse, cell-indexed list; cells you omit keep their derived value.
   */
  scatter?: ScatterStep[]
}

/**
 * One cell's SCATTER weighting — how the groove's *feel* gets spread across the
 * selected rows. `cell` indexes the grid (0 … cells-1). `prob` is the placement
 * chance at that step (0..1) before the overall density scale; `velMin`/`velMax`
 * bound the random velocity chosen when a hit fires there (accents → a loud band,
 * ghosts → a quiet one). All fields optional so an override can tweak just one.
 */
export interface ScatterStep {
  cell: number
  /** Placement probability at this step (0..1), pre-density. */
  prob?: number
  /** Velocity band lower bound when a hit fires here (0..1). */
  velMin?: number
  /** Velocity band upper bound when a hit fires here (0..1). */
  velMax?: number
}

/** Total cell count of a rhythm's grid (beats × stepsPerBeat). */
export const rhythmCells = (r: Rhythm): number => r.beats * r.stepsPerBeat

/** Default velocity for a lane (falls back to a musical 0.85). */
export const laneVelocity = (lane: Lane): number =>
  lane.velocity != null ? lane.velocity : 0.85

/** The effective velocity of a single hit (hit → accent → ghost → lane default). */
export const hitVelocity = (lane: Lane, hit: Hit): number => {
  if (hit.velocity != null) return hit.velocity
  const base = laneVelocity(lane)
  if (hit.accent) return Math.min(1, base + 0.12)
  if (hit.ghost) return Math.max(0.05, base - 0.45)
  return base
}
