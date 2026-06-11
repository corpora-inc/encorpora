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
import { gridTicks, stepsInLoop } from "../../model/timing"
import {
  applyRhythm,
  scatterRhythm,
  scatterPhrases,
  chooseHitsToSparsify,
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
export type DensityOp = "add" | "remove"

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

export interface GrooveBuildOpts {
  /**
   * Which grid this groove drives. REQUIRED — the host always knows. Defaults to
   * a drums target (resolve/create the drum track) so legacy callers keep their
   * behaviour.
   */
  target?: GrooveTarget
  /**
   * The +/− density-dial direction. "add" (default) lays one more probabilistic
   * layer (denser); "remove" thins the targeted rows (sparser). Supersedes the
   * old clear/layer split for the dial — see DensityOp.
   */
  op?: DensityOp
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

  // 2) Optionally grow the loop to one whole cycle so long rhythms fit.
  const loopTicks = fitLoopTicks(doc, rhythm, opts.fitLoop ?? true, commands)

  // 3) Build the new hits — scatter across selected rows, or the natural mapping.
  // The +/− dial's "+" lays ONE more layer at a per-tap density increment so each
  // tap adds a little (gradually denser); the legacy scatter path keeps opts.density.
  const addDensity =
    opts.op === "add" ? (opts.density ?? ADD_DENSITY_STEP_DRUMS) : opts.density

  let grooveNotes: Omit<NoteEvent, "id">[]
  if (selected.length > 0) {
    // NEW probabilistic scatter across exactly the selected rows.
    const placements = scatterRhythm(rhythm, selected, resolveRng(opts), {
      loopTicks,
      density: addDensity,
      intensity: opts.intensity,
    })
    grooveNotes = placements.map((p) => ({
      tick: p.tick,
      duration: dur,
      pitch: p.pitch,
      velocity: p.velocity,
    }))
  } else {
    // No selection → the groove on its natural kit voices (unchanged behaviour).
    const placements = applyRhythm(rhythm, { loopTicks, intensity: opts.intensity })
    grooveNotes = placements.map((p) => ({
      tick: p.tick,
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
  // The rows we thin: the explicit selection, or the groove's natural voices.
  const targeted = new Set<number>(
    selected.length > 0 ? selected : rhythm.lanes.map((l) => pitchForRole(l.role))
  )
  const onRows = notes.filter((n) => targeted.has(n.pitch))
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
  const rows = (target.selectedSnippetIds ?? [])
    .map((id) => bank.findIndex((ref) => ref.id === id))
    .filter((i) => i >= 0)

  // ---- "−" (sparser): peel a fraction of the targeted snippet rows' fragments --
  if (opts.op === "remove") {
    return sparsifyPhraseGroove(rhythm, phraseId, phraseTrack.fragments, target, bank)
  }

  // Fresh-seeded each press so scatters differ; pure/seeded so it's testable.
  const rng = resolveRng(opts)

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
  const phrasePlacements = scatterPhrases(rhythm, bank.length, rng, {
    loopTicks,
    density: phraseDensity,
    rows,
  })
  let placed = 0
  for (const pp of phrasePlacements) {
    const ref = bank[pp.snippetIndex]
    if (!ref) continue
    const key = `${pp.tick}:${ref.id}`
    if (occupied.has(key)) continue // same word already on this tick — don't dup
    occupied.add(key)
    const frag: Omit<FragmentEvent, "id"> = {
      tick: pp.tick,
      fragmentId: ref.id,
      gain: 0.9,
      pitchSemis: 0, // phrases placed at NATURAL pitch — never shifted
    }
    commands.push({ t: "placeFragment", trackId: phraseId, frag })
    placed++
  }

  // No onsets landed (e.g. every onset already occupied in layer mode): emit no
  // command so the caller can warn rather than dispatch an empty batch.
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
