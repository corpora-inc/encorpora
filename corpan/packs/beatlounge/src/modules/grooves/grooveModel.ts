/**
 * beatlounge — the GROOVE BRAIN model: turn an engine result into command-bus
 * inputs against WHATEVER GRID the host points it at. The same world-rhythm
 * corpus + apply/vary/evolve/randomize engine drives two grids today:
 *
 *   • DRUMS   — the rhythm's onsets become drum notes (role→pitch, or re-pointed
 *               at the selected kit voices via the 0/1/N targeting heuristic).
 *   • PHRASES — the rhythm's onsets become placements of SAVED bank snippets on
 *               a fragment track (distribute the bank across the groove).
 *
 * The HOST chooses the grid by passing a typed `GrooveTarget`; the model never
 * guesses. Pure of React + audio so it's unit-testable; the module's actions +
 * UI call it.
 *
 * Everything is built through EXISTING commands only (`setNotes`,
 * `placeFragment`/`removeFragment`, `addTrack`, `setLoopLength`). Applying a
 * groove only WRITES the grid — it never plays sound ("setup, don't play").
 */

import type { Command, TrackInit } from "../../model/command"
import type { BeatloungeDoc, Midi, NoteEvent, FragmentEvent } from "../../model/document"
import { isFragmentTrack, isInstrumentTrack } from "../../model/document"
import { newId } from "../../model/ids"
import { gridTicks, quantizeTick, stepsInLoop, tickForStep, type Grid } from "../../model/timing"
import {
  applyRhythm,
  scatterRhythm,
  scatterPhrases,
  chooseHitsToSparsify,
  generateBeat,
  kitPitches,
  DENSITY_LEVELS,
  rhythmTicks,
  cellTicks,
  grooveProfile,
  rhythmCells,
  type Rhythm,
  type RemovableHit,
} from "../../rhythm"
import { pitchForRole } from "../../rhythm"
import { bankSnippets } from "../../phrase/bank"

/** Resolve the drum track id: the first drumSampler instrument track, else none. */
export const findDrumTrackId = (doc: BeatloungeDoc): string | undefined =>
  doc.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")?.id

/** Resolve the first fragment (phrase) track id, if any. */
export const findPhraseTrackId = (doc: BeatloungeDoc): string | undefined =>
  doc.tracks.find(isFragmentTrack)?.id

/** A fresh drum-sampler track (mirrors createDefaultDoc's drum track shape) so a
 *  doc that somehow has none still gets a groove. */
export const newDrumTrack = (): TrackInit => ({
  id: newId("trk"),
  kind: "instrument",
  name: "Drums",
  color: "#39e0ff",
  grid: { denominator: 16 },
  volume: 0.8,
  pan: 0,
  mute: false,
  solo: false,
  inserts: [],
  sends: [],
  automation: [],
  instrument: { kind: "drumSampler", pads: [], fallback: "synthKit" },
  notes: [],
})

/**
 * GROOVE TARGET — the typed grid the brain drives. The host decides; the model
 * never guesses. A `trackId` may be supplied (the host already knows the bound
 * track); when omitted the model resolves/creates a sensible one.
 *
 *   • drums   — write the rhythm onto a drum track. `selectedPitches` carries
 *               the drum page's lane-head selection for the 0/1/N targeting
 *               heuristic; `laneLabels` is purely for the host's "applying to…"
 *               hint (the model ignores it).
 *   • phrases — distribute SAVED bank snippets onto the rhythm's onsets on a
 *               fragment track. NOTHING is written to drums.
 */
export type GrooveTarget =
  | {
      kind: "drums"
      /** The drum track to write; resolved/created when omitted. */
      trackId?: string
      /** Selected kit voices for 0/1/N re-pointing (empty ⇒ natural mapping). */
      selectedPitches?: Midi[]
      /** Human labels for the selected pitches (host hint only). */
      laneLabels?: string[]
    }
  | {
      kind: "phrases"
      /** The fragment track to place onto; resolved when omitted. */
      trackId?: string
      /** Selected snippet rows (FragmentRef ids) to put the groove on — like the
       *  drums' selectedPitches. Empty ⇒ spread random snippets across onsets. */
      selectedSnippetIds?: string[]
    }

/**
 * THE +/− DENSITY DIAL. The Grooves panel's whole apply surface is now ONE
 * granular control: "+" lays one more probabilistic layer of the groove on the
 * targeted rows (denser); "−" peels a fraction of the current hits back off
 * (sparser), lowest-emphasis first, down to nothing.
 *
 *   • "add"    — ADDITIVE scatter at a per-tap density increment, merged with
 *                what's already there (never clears). Fresh seed each tap ⇒ each
 *                + re-rolls a different sprinkle, gradually denser.
 *   • "remove" — pure sparsify: drop ~SPARSIFY_FRACTION of the targeted rows'
 *                current hits (off-beat / quiet first). Each − thins further; the
 *                last − removes the last hit.
 *
 * ASYMMETRY ("harder to take away than to add"): a single + adds at
 * `ADD_DENSITY_STEP` of the groove's full profile, while a single − removes only
 * `SPARSIFY_FRACTION` of what's present — a smaller bite — so it takes more −
 * taps to undo a +.
 */
export type DensityOp = "add" | "remove" | "generate"

/**
 * THE GENERATOR LEVEL — the home/Drums +/− dial's primary model. Unlike the old
 * additive "add" (which layered the same scatter), the dial now REGENERATES a
 * fresh stochastic beat across the WHOLE kit at a density LEVEL each press:
 *   • "+" raises the level → a denser, all-new beat (fresh seed every press);
 *   • "−" lowers the level → a sparser all-new beat, down to LEVEL 0 = empty.
 * Level 1 from empty averages ~5 hits (legitimately 1–10). Each press clears the
 * targeted rows and lays a brand-new generated beat, so the kit is never a stale
 * stock pattern. The dial tracks the level on its surface and passes it here.
 */
export const MAX_DENSITY_LEVEL = DENSITY_LEVELS

/** Per-+-tap drum scatter density (fraction of the groove's full profile). */
export const ADD_DENSITY_STEP_DRUMS = 0.5
/**
 * Per-+-tap PHRASE scatter density — DRAMATICALLY lower than drums (~90%
 * sparser) so one + on a phrase groove drops only a handful of well-placed
 * words (clustered on the strongest onsets), not a word on every 8th. Build
 * density with more + taps.
 */
export const ADD_DENSITY_STEP_PHRASES = 0.05
/** Per-−-tap fraction of CURRENT hits removed — smaller than a + adds (gentle). */
export const SPARSIFY_FRACTION = 0.3

/**
 * Bounded re-roll cap for the "+ always adds ≥1" guarantee. A probabilistic "+"
 * can roll ZERO onsets (sparse phrase density) OR have every rolled onset already
 * occupied; rather than fail, we re-roll with a fresh seed up to this many times,
 * then fall back to a deterministic forced placement. Keeps the engine from ever
 * returning "nothing happened" on a "+", with no unbounded loop.
 */
export const PLUS_REROLL_CAP = 6

export interface GrooveBuildOpts {
  /**
   * Which grid this groove drives. REQUIRED — the host always knows. Defaults to
   * a drums target (resolve/create the drum track) so legacy callers keep their
   * behaviour.
   */
  target?: GrooveTarget
  /**
   * The +/− density-dial direction. "generate" (the home/Drums dial) REGENERATES
   * a fresh stochastic beat across the whole kit at `level`. "add" (legacy) lays
   * one more probabilistic layer; "remove" thins the targeted rows. See DensityOp.
   */
  op?: DensityOp
  /**
   * The generator DENSITY LEVEL for `op:"generate"` (0..MAX_DENSITY_LEVEL). 0 ⇒
   * empty; 1 ⇒ ~5 hits; higher ⇒ denser. The dial tracks + passes this.
   */
  level?: number
  /** 0..1 — scale all hit velocities. Default 1. */
  intensity?: number
  /**
   * If true and the rhythm's natural cycle is longer than the current loop,
   * grow the loop to one whole cycle so the groove isn't truncated mid-pattern
   * (used by Apply so a 16-matra teental gets room). Default true.
   */
  fitLoop?: boolean
  /**
   * CLEAR mode (the "Clear + scatter" variant of the primary action). When true
   * the TARGETED rows are wiped before the new hits/placements are laid down —
   * the selected kit voices (or, with no selection, the groove's natural voices)
   * for drums; the whole fragment track for phrases. The default (false) LAYERS:
   * existing notes are kept and the scatter is added on top. There is no separate
   * "replace everything" mode any more — the two actions are LAYER and CLEAR+LAYER.
   */
  clear?: boolean
  /**
   * Overall SCATTER DENSITY (0..1) — scales every step's derived probability.
   * 1 ⇒ the groove's natural feel; lower ⇒ sparser. Default 1. (The old
   * `intensity` still scales velocities.)
   */
  density?: number
  /**
   * Per-press SEED for the scatter RNG. Each press should pass a FRESH seed
   * (e.g. `Math.floor(Math.random() * 2**31)` in the UI handler) so repeated
   * presses give genuinely different, surprising scatters while the engine logic
   * stays pure/seeded + testable. When omitted, `rng` is used directly, else a
   * default deterministic stream.
   */
  seed?: number
  /** Phrase density (0..1) for a phrases target. Default 0.6. */
  phraseDensity?: number
  /** A seeded RNG (used for scatter/phrases when `seed` is not supplied). */
  rng?: () => number
}

/** mulberry32 — the pack-standard deterministic stream from an integer seed. */
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

/** Resolve the RNG the scatter uses: a fresh-seeded stream (per-press seed) →
 *  the passed rng → a default. So each UI press is different but reproducible. */
const resolveRng = (opts: GrooveBuildOpts): (() => number) =>
  opts.seed != null ? makeRng(opts.seed) : opts.rng ?? makeRng(1)

/**
 * Snap a placed tick to the TRACK'S VISIBLE GRID step. A world rhythm's cell grid
 * (e.g. triplets — `stepsPerBeat: 3` ⇒ 320-tick cells) can land notes BETWEEN the
 * 16th-note steps the UI renders → "phantom hits" the user can't see or edit. We
 * quantize every placement to the nearest grid cell so a placed note is ALWAYS on
 * a cell the grid draws. Collisions from snapping are removed by the caller's
 * (tick, …) de-dupe. Pure; uses the canonical `quantizeTick`.
 */
const snapTickToGrid = (tick: number, grid: Grid): number => quantizeTick(tick, grid)

/**
 * GUARANTEE ≥1 drum hit for a "+": when the probabilistic scatter rolled zero
 * onsets, re-roll with fresh seeds (bounded by PLUS_REROLL_CAP), then — if STILL
 * empty — force one hit on the groove's STRONGEST onset cell, on the first
 * selected row. So a "+" always adds at least one audible, on-grid hit. Pure +
 * deterministic given the seed; no unbounded loop.
 */
const guaranteedScatter = (
  rhythm: Rhythm,
  selected: number[],
  opts: GrooveBuildOpts,
  loopTicks: number,
  density: number | undefined
): NonNullable<ReturnType<typeof scatterRhythm>> => {
  const baseSeed = opts.seed ?? 1
  for (let i = 1; i <= PLUS_REROLL_CAP; i++) {
    const rng = makeRng((baseSeed + i * 0x9e3779b1) | 0)
    const placements = scatterRhythm(rhythm, selected, rng, {
      loopTicks,
      density,
      intensity: opts.intensity,
    })
    if (placements.length > 0) return placements
  }
  // Deterministic fallback: the loudest/most-likely onset cell of the rhythm.
  const profile = grooveProfile(rhythm)
  const ct = cellTicks(rhythm)
  let best = 0
  for (let c = 1; c < profile.length; c++) {
    if ((profile[c]?.prob ?? 0) > (profile[best]?.prob ?? 0)) best = c
  }
  const step = profile[best]
  const intensity = opts.intensity == null ? 1 : Math.max(0, opts.intensity)
  const vel = Math.max(0, Math.min(1, (step?.velMax ?? 0.9) * intensity))
  return [{ tick: best * ct, pitch: selected[0], velocity: vel }]
}

export interface GrooveBuildResult {
  commands: Command[]
  /** Human summary for the toast / undo affordance. */
  summary: string
  /** True if a phrase track received placements. */
  placedPhrases: boolean
  /**
   * True when a PHRASES target couldn't be satisfied because the doc has no
   * fragment track or an empty bank. Lets the caller surface a visible hint /
   * disable Apply instead of a silent no-op.
   */
  phrasesUnavailable: boolean
}

/**
 * Build the command list to apply `rhythm` to the host-chosen grid. Returns ONE
 * coherent list the caller wraps in a batch (single undo step). Dispatches to
 * the drums path or the phrases path by `opts.target.kind`.
 */
export const buildGrooveCommands = (
  doc: BeatloungeDoc,
  rhythm: Rhythm,
  opts: GrooveBuildOpts = {}
): GrooveBuildResult => {
  const target: GrooveTarget = opts.target ?? { kind: "drums" }
  return target.kind === "phrases"
    ? buildPhraseGroove(doc, rhythm, target, opts)
    : buildDrumGroove(doc, rhythm, target, opts)
}

/** Grow the loop (and emit `setLoopLength`) so a long cycle fits. */
const fitLoopTicks = (
  doc: BeatloungeDoc,
  rhythm: Rhythm,
  fitLoop: boolean,
  commands: Command[]
): number => {
  const cycle = rhythmTicks(rhythm)
  const loopTicks = fitLoop ? Math.max(doc.loopLengthTicks, cycle) : doc.loopLengthTicks
  if (fitLoop && loopTicks !== doc.loopLengthTicks) {
    commands.push({ t: "setLoopLength", ticks: loopTicks })
  }
  return loopTicks
}

/**
 * A tick → groove-onset-probability lookup for the SPARSIFY ranking: maps any
 * tick back to its cell in the rhythm's cycle and returns that cell's profile
 * probability (high on a strong onset, low off-beat). Hits on low-prob cells are
 * the first the "−" peels away. Pure; built once per build.
 */
const makeCellProbOf = (rhythm: Rhythm): ((tick: number) => number) => {
  const profile = grooveProfile(rhythm)
  const cells = rhythmCells(rhythm)
  const ct = cellTicks(rhythm)
  if (cells <= 0 || ct <= 0) return () => 1
  return (tick: number): number => {
    const cell = ((Math.round(tick / ct) % cells) + cells) % cells
    return profile[cell]?.prob ?? 1
  }
}

/**
 * DRUMS grid — the rhythm becomes drum notes. Two paths by selection:
 *
 *   • NO rows selected → the groove plays on its NATURAL kit voices (role→pitch),
 *     exactly as before. (We don't force the scatter when nothing is selected.)
 *   • 1+ rows selected → the PROBABILISTIC SCATTER (scatterRhythm): for each
 *     selected row × each step, maybe place a hit (chance from the groove's
 *     profile × density) at a random velocity within that step's band. A fresh
 *     per-press seed makes every press different + surprising.
 *
 * Both paths LAYER by default (add to the track's existing notes). The CLEAR
 * variant wipes the TARGETED rows first — the selected voices, or (no selection)
 * the groove's natural voices — then lays the new hits on top.
 */
const buildDrumGroove = (
  doc: BeatloungeDoc,
  rhythm: Rhythm,
  target: Extract<GrooveTarget, { kind: "drums" }>,
  opts: GrooveBuildOpts
): GrooveBuildResult => {
  const commands: Command[] = []

  // 1) Resolve the drum track. Prefer the host-supplied id; else find one; else
  //    create one and target it.
  let drumId = target.trackId ?? findDrumTrackId(doc)
  if (!drumId || !doc.tracks.some((t) => t.id === drumId)) {
    const track = newDrumTrack()
    commands.push({ t: "addTrack", track })
    drumId = track.id as string
  }
  const drumGrid = doc.tracks.find((t) => t.id === drumId)

  const refGrid = drumGrid && isInstrumentTrack(drumGrid) ? drumGrid.grid : { denominator: 16 as const }
  // Duration: a touch under a cell so adjacent hits don't bleed.
  const dur = Math.max(1, Math.round(gridTicks(refGrid) / 2))
  const selected = (target.selectedPitches ?? []).filter((p) => Number.isFinite(p))

  // ---- "−" (sparser): peel a fraction of the targeted rows' current hits ------
  // Pure: choose which existing notes to remove (off-beat/quiet first), down to
  // nothing. Removes only — never grows the loop, never lays new hits.
  if (opts.op === "remove") {
    return sparsifyDrumGroove(doc, rhythm, drumId, drumGrid, selected)
  }

  // ---- "generate" (the +/− dial): a FRESH stochastic beat across the kit ------
  // Regenerate the whole beat at the dial's density LEVEL, replacing the targeted
  // rows (all rows when nothing is selected). Every press is a brand-new beat
  // (fresh seed) — never a stale stock pattern.
  if (opts.op === "generate") {
    return generateDrumGroove(doc, rhythm, drumId, drumGrid, refGrid, selected, opts, commands)
  }

  // 2) Optionally grow the loop to one whole cycle so long rhythms fit.
  const loopTicks = fitLoopTicks(doc, rhythm, opts.fitLoop ?? true, commands)

  // 3) Build the new hits — scatter across selected rows, or the natural mapping.
  // The +/− dial's "+" lays ONE more layer at a per-tap density increment so each
  // tap adds a little (gradually denser); the legacy scatter path keeps opts.density.
  const addDensity =
    opts.op === "add" ? (opts.density ?? ADD_DENSITY_STEP_DRUMS) : opts.density

  // Snap every placement onto the drum track's visible grid so a hit is never
  // off-grid (a triplet rhythm on a 16th grid would otherwise drop phantom hits).
  const snap = (tick: number): number => snapTickToGrid(tick, refGrid)

  let grooveNotes: Omit<NoteEvent, "id">[]
  if (selected.length > 0) {
    // NEW probabilistic scatter across exactly the selected rows. A "+" GUARANTEES
    // at least one hit: a sparse roll that yields nothing is re-rolled (fresh
    // seed) up to PLUS_REROLL_CAP, then forced onto the strongest onset.
    let placements = scatterRhythm(rhythm, selected, resolveRng(opts), {
      loopTicks,
      density: addDensity,
      intensity: opts.intensity,
    })
    if (placements.length === 0 && opts.op === "add") {
      placements = guaranteedScatter(rhythm, selected, opts, loopTicks, addDensity)
    }
    grooveNotes = placements.map((p) => ({
      tick: snap(p.tick),
      duration: dur,
      pitch: p.pitch,
      velocity: p.velocity,
    }))
  } else {
    // No selection → the groove on ALL its natural kit voices (every lane).
    const placements = applyRhythm(rhythm, { loopTicks, intensity: opts.intensity })
    grooveNotes = placements.map((p) => ({
      tick: snap(p.tick),
      duration: dur,
      pitch: p.pitch,
      velocity: p.velocity,
      ...(p.ratchet && p.ratchet > 1 ? { ratchet: p.ratchet } : {}),
    }))
  }

  // The rows this action TARGETS — selected voices, or (no selection) the
  // groove's natural voices. CLEAR wipes existing notes on these rows first.
  const targetedPitches = new Set<number>(
    selected.length > 0 ? selected : rhythm.lanes.map((l) => pitchForRole(l.role))
  )

  // Existing notes we KEEP: everything when layering; only notes OUTSIDE the
  // targeted rows when clearing (so Clear+scatter resets those voices cleanly).
  const existingAll: Omit<NoteEvent, "id">[] =
    drumGrid && isInstrumentTrack(drumGrid)
      ? drumGrid.notes.map(({ tick, duration, pitch, velocity, probability, ratchet, micro }) => ({
          tick,
          duration,
          pitch,
          velocity,
          ...(probability != null ? { probability } : {}),
          ...(ratchet != null ? { ratchet } : {}),
          ...(micro != null ? { micro } : {}),
        }))
      : []
  const existing = opts.clear
    ? existingAll.filter((n) => !targetedPitches.has(n.pitch))
    : existingAll

  // Union existing + groove, de-duped by (tick, pitch) — keep the FIRST so a
  // re-layer is idempotent and a clave can sit over a backbeat.
  const seen = new Set<string>()
  const notes: Omit<NoteEvent, "id">[] = []
  for (const n of [...existing, ...grooveNotes]) {
    const key = `${n.tick}:${n.pitch}`
    if (seen.has(key)) continue
    seen.add(key)
    notes.push(n)
  }
  notes.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch)
  commands.push({ t: "setNotes", trackId: drumId, notes })

  const placed = grooveNotes.length
  const hitWord = `${placed} hit${placed === 1 ? "" : "s"}`
  const where =
    selected.length > 0 ? ` across ${selected.length} row${selected.length === 1 ? "" : "s"}` : ""
  const verb = opts.clear ? "reset · " : ""
  return {
    commands,
    summary: `${rhythm.name} · ${verb}${hitWord}${where}`,
    placedPhrases: false,
    phrasesUnavailable: false,
  }
}

/**
 * THE GENERATOR PATH — the +/− dial regenerates a FRESH stochastic beat across the
 * whole kit (or the selected rows) at `opts.level`. It REPLACES the targeted rows'
 * notes (level 0 ⇒ those rows go empty) and lays the brand-new generated beat on
 * top of whatever's on the untouched rows. Each press uses a fresh seed (the UI
 * passes one) so the beat is genuinely new every time — never a stock pattern.
 *
 * "All rows" when nothing is selected = the WHOLE kit (KIT_ROLES via the generator
 * default), so the rhythm spreads over every drum row, not the groove's 3 lanes.
 */
const generateDrumGroove = (
  _doc: BeatloungeDoc,
  rhythm: Rhythm,
  drumId: string,
  drumGrid: ReturnType<BeatloungeDoc["tracks"]["find"]>,
  refGrid: Grid,
  selected: number[],
  opts: GrooveBuildOpts,
  commands: Command[]
): GrooveBuildResult => {
  const loopTicks = fitLoopTicks(_doc, rhythm, opts.fitLoop ?? false, commands)
  const stepsPerBeat = Math.max(1, Math.round(refGrid.denominator / 4))
  const level = Math.max(0, Math.min(MAX_DENSITY_LEVEL, Math.round(opts.level ?? 1)))
  const dur = Math.max(1, Math.round(gridTicks(refGrid) / 2))
  const snap = (tick: number): number => snapTickToGrid(tick, refGrid)

  // Generate the fresh beat across the selected rows, or ALL kit rows (default).
  const placements = generateBeat(rhythm, resolveRng(opts), {
    loopTicks,
    stepsPerBeat,
    level,
    rows: selected.length > 0 ? selected : undefined,
    intensity: opts.intensity,
  })
  const grooveNotes: Omit<NoteEvent, "id">[] = placements.map((p) => ({
    tick: snap(p.tick),
    duration: dur,
    pitch: p.pitch,
    velocity: p.velocity,
  }))

  // ADDITIVE: "+" strictly ADDS a fresh stochastic layer — keep EVERY existing
  // note and union the new hits on top (de-dupe by tick+pitch so a hit landing on
  // an occupied cell is a harmless no-op). Each press lays more across the kit, so
  // repeated + gets denser (never a clear-then-replace "shuffle"). "−" is the
  // separate `remove` op (sparsifyDrumGroove), so the dial is strictly +/−.
  const existingAll: Omit<NoteEvent, "id">[] =
    drumGrid && isInstrumentTrack(drumGrid)
      ? drumGrid.notes.map(({ tick, duration, pitch, velocity, probability, ratchet, micro }) => ({
          tick,
          duration,
          pitch,
          velocity,
          ...(probability != null ? { probability } : {}),
          ...(ratchet != null ? { ratchet } : {}),
          ...(micro != null ? { micro } : {}),
        }))
      : []

  const seen = new Set<string>()
  const notes: Omit<NoteEvent, "id">[] = []
  for (const n of [...existingAll, ...grooveNotes]) {
    const key = `${n.tick}:${n.pitch}`
    if (seen.has(key)) continue
    seen.add(key)
    notes.push(n)
  }
  // Net new hits actually added (those that didn't collide with an existing note).
  let added = notes.length - existingAll.length

  // GUARANTEE: a "+" must always do SOMETHING if there's any space. When the roll
  // lands nothing on the targeted rows (an "off-groove" row the weights barely
  // favour — no groove should fully reject a drum), force ONE hit on a free cell,
  // metric-weighted (downbeats favoured) but every empty cell has a chance. So
  // "+ on any row, any groove" reliably adds — never a dead "no room".
  if (added <= 0 && level > 0) {
    const rows = selected.length > 0 ? selected : kitPitches()
    const forced = forceOneHit(rows, seen, refGrid, loopTicks, stepsPerBeat, dur, resolveRng(opts), opts.intensity)
    if (forced) {
      notes.push(forced)
      added = 1
    }
  }

  notes.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch)
  commands.push({ t: "setNotes", trackId: drumId, notes })

  const where =
    selected.length > 0 ? ` · ${selected.length} row${selected.length === 1 ? "" : "s"}` : ""
  const summary =
    added <= 0
      ? `${rhythm.name} · full`
      : `${rhythm.name} · +${added} hit${added === 1 ? "" : "s"}${where}`
  return { commands, summary, placedPhrases: false, phrasesUnavailable: false }
}

/**
 * Force ONE hit on a FREE cell across the targeted rows — the "+ always adds if
 * there's space" guarantee. Every empty (row, step) is a candidate with a NON-ZERO
 * weight (no place is ever rejected); strong metric positions (downbeats > beats >
 * backbeats > off-beats) are weighted heavier so the forced hit still feels placed,
 * not random junk. Returns null only when there is genuinely no free cell.
 */
const forceOneHit = (
  rows: number[],
  occupied: Set<string>,
  grid: Grid,
  loopTicks: number,
  stepsPerBeat: number,
  dur: number,
  rng: () => number,
  intensity: number | undefined
): Omit<NoteEvent, "id"> | null => {
  const steps = Math.max(0, stepsInLoop(loopTicks, grid))
  if (steps === 0 || rows.length === 0) return null
  const perBar = Math.max(1, stepsPerBeat * 4)
  // Metric weight: every place has SOME probability (0.5 floor); beats lift it.
  const metric = (s: number): number => {
    const inBar = s % perBar
    if (inBar === 0) return 4 // bar downbeat
    if (inBar % stepsPerBeat === 0) return inBar === stepsPerBeat * 2 ? 3 : 2.4 // beat 3 / other beats
    if (inBar % stepsPerBeat === Math.floor(stepsPerBeat / 2)) return 1.2 // off-beat eighth
    return 0.5 // every other place — never zero
  }
  const candidates: { tick: number; pitch: number; w: number }[] = []
  let total = 0
  for (const pitch of rows) {
    for (let s = 0; s < steps; s++) {
      const tick = snapTickToGrid(tickForStep(s, grid), grid)
      if (occupied.has(`${tick}:${pitch}`)) continue
      const w = metric(s)
      candidates.push({ tick, pitch, w })
      total += w
    }
  }
  if (candidates.length === 0) return null // genuinely full
  let r = rng() * total
  let pick = candidates[candidates.length - 1]
  for (const c of candidates) {
    r -= c.w
    if (r <= 0) {
      pick = c
      break
    }
  }
  const vel = Math.max(0, Math.min(1, 0.78 * (intensity == null ? 1 : Math.max(0, intensity))))
  return { tick: pick.tick, duration: dur, pitch: pick.pitch, velocity: vel }
}

/**
 * "−" on DRUMS — make the targeted rows SPARSER. Remove ~SPARSIFY_FRACTION of
 * the current hits on the selected rows (or, with no selection, the groove's
 * natural voices), lowest-emphasis first (off-beat / quiet before strong onsets),
 * via the pure `chooseHitsToSparsify`. Each − thins further; the last − removes
 * the last hit. Emits `removeNote` per dropped note — one undo batch, no new hits.
 */
const sparsifyDrumGroove = (
  _doc: BeatloungeDoc,
  rhythm: Rhythm,
  drumId: string,
  drumGrid: ReturnType<BeatloungeDoc["tracks"]["find"]>,
  selected: number[]
): GrooveBuildResult => {
  const notes =
    drumGrid && isInstrumentTrack(drumGrid) ? drumGrid.notes : []
  // Rows we thin: the explicit selection, or — with NO selection — the WHOLE kit
  // (every hit on the grid is in play), so "−" mirrors "+"'s kit-wide reach and
  // never says "nothing to thin" while hits sit on un-natural rows.
  const targeted = new Set<number>(selected)
  const onRows =
    selected.length > 0 ? notes.filter((n) => targeted.has(n.pitch)) : notes
  if (onRows.length === 0) {
    return {
      commands: [],
      summary: "Nothing to thin",
      placedPhrases: false,
      phrasesUnavailable: false,
    }
  }
  const removable: RemovableHit[] = onRows.map((n) => ({
    ref: n.id,
    tick: n.tick,
    velocity: n.velocity,
  }))
  const cellProbOf = makeCellProbOf(rhythm)
  const toRemove = chooseHitsToSparsify(removable, SPARSIFY_FRACTION, cellProbOf)
  const commands: Command[] = toRemove.map((h) => ({
    t: "removeNote",
    trackId: drumId,
    noteId: h.ref,
  }))
  const n = toRemove.length
  return {
    commands,
    summary: `${rhythm.name} · −${n} hit${n === 1 ? "" : "s"}`,
    placedPhrases: false,
    phrasesUnavailable: false,
  }
}

/**
 * PHRASES grid — the same SCATTER idea on phrase snippet lanes: walk the groove's
 * steps and probabilistically drop a random saved-bank snippet (chance from the
 * groove profile), differently each press. LAYER keeps the held placements and
 * adds on free onsets; CLEAR wipes the track first. NOTHING is written to drums.
 * When there's no fragment track or an empty bank, returns `phrasesUnavailable`
 * (no silent no-op) so the host surfaces a visible hint.
 */
const buildPhraseGroove = (
  doc: BeatloungeDoc,
  rhythm: Rhythm,
  target: Extract<GrooveTarget, { kind: "phrases" }>,
  opts: GrooveBuildOpts
): GrooveBuildResult => {
  const phraseId = target.trackId ?? findPhraseTrackId(doc)
  const bank = bankSnippets(doc)
  const phraseTrack = phraseId ? doc.tracks.find((t) => t.id === phraseId) : undefined

  // A phrases target needs a real fragment track AND a non-empty bank. Without
  // them we DON'T touch the doc — surface a visible hint instead.
  if (!phraseId || !phraseTrack || !isFragmentTrack(phraseTrack) || bank.length === 0) {
    return {
      commands: [],
      summary: bank.length === 0 ? "Save some phrases first" : "No phrase track yet",
      placedPhrases: false,
      phrasesUnavailable: true,
    }
  }
  // Selected snippet rows → put the groove on exactly those rows (like drums).
  // NO selection ⇒ ALL snippet rows (every bank entry), so the groove spreads
  // across every phrase row, not a single random snippet per onset.
  const selectedRows = (target.selectedSnippetIds ?? [])
    .map((id) => bank.findIndex((ref) => ref.id === id))
    .filter((i) => i >= 0)
  const rows = selectedRows.length > 0 ? selectedRows : bank.map((_, i) => i)

  // ---- "−" (sparser): peel a fraction of the targeted snippet rows' fragments --
  if (opts.op === "remove") {
    return sparsifyPhraseGroove(rhythm, phraseId, phraseTrack.fragments, target, bank)
  }

  const commands: Command[] = []
  // Grow the loop so a long cycle isn't truncated, exactly like the drums path.
  const loopTicks = fitLoopTicks(doc, rhythm, opts.fitLoop ?? true, commands)

  // CLEAR wipes existing placements; LAYER keeps them and adds on top.
  if (opts.clear) {
    for (const ev of phraseTrack.fragments) {
      commands.push({ t: "removeFragment", trackId: phraseId, fragId: ev.id })
    }
  }
  // Keyed by tick+snippet so the SAME word isn't doubled on a tick, but DIFFERENT
  // words can layer on the same beat (the whole point — layering phrases).
  const occupied = opts.clear
    ? new Set<string>()
    : new Set(phraseTrack.fragments.map((f) => `${f.tick}:${f.fragmentId}`))

  // The "+" dial lays ONE more layer at the MUCH-SPARSER phrase density step
  // (~90% sparser than drums) so each + drops only a handful of well-placed words;
  // the legacy scatter path keeps its 0.6 default.
  const phraseDensity =
    opts.op === "add"
      ? (opts.phraseDensity ?? ADD_DENSITY_STEP_PHRASES)
      : (opts.phraseDensity ?? 0.6)

  // The phrase track's visible grid — every placement snaps to it so a word is
  // never dropped between the steps the UI renders (phantom phrase placement).
  const phraseGrid = phraseTrack.grid

  // Roll scatter placements (snapped to the grid, de-duped by tick+snippet). A "+"
  // GUARANTEES ≥1 placement: a sparse/empty roll is re-rolled with a fresh seed
  // up to PLUS_REROLL_CAP, then forced onto the strongest onset. No silent no-op.
  const rollPlacements = (rng: () => number): { frag: Omit<FragmentEvent, "id">; key: string }[] => {
    const out: { frag: Omit<FragmentEvent, "id">; key: string }[] = []
    const seen = new Set<string>()
    for (const pp of scatterPhrases(rhythm, bank.length, rng, {
      loopTicks,
      density: phraseDensity,
      rows,
    })) {
      const ref = bank[pp.snippetIndex]
      if (!ref) continue
      const tick = snapTickToGrid(pp.tick, phraseGrid)
      const key = `${tick}:${ref.id}`
      if (occupied.has(key) || seen.has(key)) continue // same word already here
      seen.add(key)
      out.push({
        key,
        frag: { tick, fragmentId: ref.id, gain: 0.9, pitchSemis: 0 }, // natural pitch
      })
    }
    return out
  }

  let toPlace = rollPlacements(resolveRng(opts))
  if (toPlace.length === 0 && opts.op === "add") {
    const baseSeed = opts.seed ?? 1
    for (let i = 1; i <= PLUS_REROLL_CAP && toPlace.length === 0; i++) {
      toPlace = rollPlacements(makeRng((baseSeed + i * 0x9e3779b1) | 0))
    }
    if (toPlace.length === 0) {
      // Deterministic fallback: force the strongest onset cell, first row's snippet.
      const profile = grooveProfile(rhythm)
      const ct = cellTicks(rhythm)
      let best = 0
      for (let c = 1; c < profile.length; c++) {
        if ((profile[c]?.prob ?? 0) > (profile[best]?.prob ?? 0)) best = c
      }
      const ref = bank[rows[0]]
      if (ref) {
        const tick = snapTickToGrid(best * ct, phraseGrid)
        const key = `${tick}:${ref.id}`
        if (!occupied.has(key)) {
          toPlace = [{ key, frag: { tick, fragmentId: ref.id, gain: 0.9, pitchSemis: 0 } }]
        }
      }
    }
  }

  let placed = 0
  for (const { frag } of toPlace) {
    commands.push({ t: "placeFragment", trackId: phraseId, frag })
    placed++
  }

  // Truly nothing to place (e.g. every onset already occupied in layer mode and a
  // "remove"/legacy path): emit no command so the caller can warn rather than
  // dispatch an empty batch. A "+" never reaches here (guaranteed ≥1 above).
  if (placed === 0) {
    return {
      commands: [],
      summary: "No onsets to place phrases on",
      placedPhrases: false,
      phrasesUnavailable: false,
    }
  }

  const word = `${placed} phrase${placed === 1 ? "" : "s"}`
  const verb = opts.clear ? "reset · " : ""
  return {
    commands,
    summary: `${rhythm.name} · ${verb}${word}`,
    placedPhrases: true,
    phrasesUnavailable: false,
  }
}

/**
 * "−" on PHRASES — thin the targeted snippet rows. Remove ~SPARSIFY_FRACTION of
 * the current fragment placements on the selected snippet rows (or, with no
 * selection, all rows), off-beat first via the shared sparsify ranking. Each −
 * peels back; the last − removes the last word. Emits `removeFragment` per drop.
 */
const sparsifyPhraseGroove = (
  rhythm: Rhythm,
  phraseId: string,
  fragments: readonly FragmentEvent[],
  target: Extract<GrooveTarget, { kind: "phrases" }>,
  bank: ReturnType<typeof bankSnippets>
): GrooveBuildResult => {
  // Targeted snippet fragment-ids: the selection, or every saved snippet.
  const selectedIds = target.selectedSnippetIds ?? []
  const targetIds = new Set<string>(
    selectedIds.length > 0 ? selectedIds : bank.map((b) => b.id)
  )
  const onRows = fragments.filter((f) => targetIds.has(f.fragmentId))
  if (onRows.length === 0) {
    return {
      commands: [],
      summary: "Nothing to thin",
      placedPhrases: false,
      phrasesUnavailable: false,
    }
  }
  // Phrases carry no velocity — rank by gain (a stand-in for emphasis) + cell prob.
  const removable: RemovableHit[] = onRows.map((f) => ({
    ref: f.id,
    tick: f.tick,
    velocity: f.gain,
  }))
  const cellProbOf = makeCellProbOf(rhythm)
  const toRemove = chooseHitsToSparsify(removable, SPARSIFY_FRACTION, cellProbOf)
  const commands: Command[] = toRemove.map((h) => ({
    t: "removeFragment",
    trackId: phraseId,
    fragId: h.ref,
  }))
  const n = toRemove.length
  return {
    commands,
    summary: `${rhythm.name} · −${n} phrase${n === 1 ? "" : "s"}`,
    placedPhrases: false,
    phrasesUnavailable: false,
  }
}

/** Steps shown for a rhythm against the current loop (for the tile preview). */
export const previewSteps = (doc: BeatloungeDoc): number => {
  const drumId = findDrumTrackId(doc)
  const drum = doc.tracks.find((t) => t.id === drumId)
  const grid = drum && isInstrumentTrack(drum) ? drum.grid : { denominator: 16 as const }
  return Math.max(0, stepsInLoop(doc.loopLengthTicks, grid))
}
