/**
 * beatlounge — the world-rhythms OPERATIONS ENGINE (pure, reproducible).
 *
 * No audio, no React, no document mutation. Every function is a pure
 * transform of `Rhythm` data + a seeded RNG → either a new `Rhythm` (vary /
 * evolve / randomize) or a list of placements the caller turns into command-bus
 * inputs (apply / applyToPhrases). Seeded so reroll is reproducible and the
 * whole result is one undo batch.
 *
 * CELL → TICK MAPPING. A rhythm lives on a `beats × stepsPerBeat` cell grid.
 * One cell spans `PPQ / stepsPerBeat` ticks, so the rhythm's natural length is
 * `cells × cellTicks = beats × PPQ` ticks — independent of the song's loop. We
 * TILE the pattern across the target loop (repeat whole cycles, then truncate a
 * trailing partial cycle), so a 1-bar clave fills a 4-bar loop and a 16-matra
 * teental that's longer than the loop is cleanly truncated. The native length
 * is reported so a caller (the Grooves module) can grow the loop to fit.
 */

import { PPQ } from "../model/timing"
import { hitVelocity, laneVelocity, rhythmCells, type Hit, type Lane, type Rhythm } from "./types"
import { pitchForRole } from "./roles"
import { RHYTHMS } from "./corpus"
import { grooveProfile } from "./profile"

// ----------------------------------------------------------------- RNG helpers
const randInt = (rng: () => number, lo: number, hi: number): number =>
  lo + Math.floor(rng() * (hi - lo + 1))

const pickOne = <T>(rng: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length) % arr.length]

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Ticks spanned by one cell of a rhythm. */
export const cellTicks = (r: Rhythm): number => Math.round(PPQ / r.stepsPerBeat)

/** A rhythm's natural length in ticks (one full cycle). */
export const rhythmTicks = (r: Rhythm): number => rhythmCells(r) * cellTicks(r)

// ================================================================ applyRhythm
/** A concrete note placement (role resolved → pitch), tick-addressed. */
export interface NotePlacement {
  tick: number
  pitch: number
  velocity: number
  /** Subdivide into N rapid strikes (rolls/flams). Absent ⇒ 1. */
  ratchet?: number
}

export interface ApplyOptions {
  /** Loop length to tile across, in ticks (defaults to the rhythm's own length). */
  loopTicks?: number
  /** Scale all velocities (0..1). Default 1. */
  intensity?: number
  /** If true, a trailing partial cycle is dropped instead of truncated mid-cycle. */
  wholeCyclesOnly?: boolean
  /**
   * DRUM TARGETING — which kit voice(s) the rhythm should play on. The drum page
   * lets the user select lane heads; this carries that selection so a groove can
   * be re-pointed at arbitrary kit voices (e.g. play a clave on the kick).
   *
   *   • undefined / empty → the natural role→DRUM_PITCH mapping (unchanged).
   *   • exactly one pitch → COLLAPSE: union ALL the rhythm's onsets (across every
   *     lane) onto that single pitch, so the whole pattern triggers one voice.
   *   • N pitches        → DISTRIBUTE: rank the rhythm's lanes by importance and
   *     assign the top-N lanes, in order, to the N selected pitches.
   *
   * See `collapseTo` / `distributeAcross` for the exact heuristics.
   */
  targetPitches?: number[]
}

/**
 * Produce the concrete note placements for a drum track from a rhythm, tiled
 * across `loopTicks`. Pure; the caller maps these to `setNotes` inputs.
 *
 * When `targetPitches` is set the role→pitch mapping is overridden by the
 * targeting heuristics (collapse to one voice / distribute across N voices).
 */
export const applyRhythm = (r: Rhythm, opts: ApplyOptions = {}): NotePlacement[] => {
  const ct = cellTicks(r)
  const oneCycle = rhythmTicks(r)
  if (oneCycle <= 0) return []
  const loop = Math.max(oneCycle, Math.round(opts.loopTicks ?? oneCycle))
  const intensity = opts.intensity == null ? 1 : Math.max(0, opts.intensity)

  // How many cycle copies cover the loop (whole + maybe a partial tail).
  const fullCopies = Math.floor(loop / oneCycle)
  const tailTicks = loop - fullCopies * oneCycle
  const copies = opts.wholeCyclesOnly ? fullCopies : fullCopies + (tailTicks > 0 ? 1 : 0)

  // Resolve the per-lane pitch override from the targeting selection (if any).
  // `laneTargets` maps lane index → kit pitch; lanes absent from the map are
  // dropped (only the top-N lanes survive an N-pitch distribution).
  const targets = (opts.targetPitches ?? []).filter((p) => Number.isFinite(p))
  const targeting = targets.length > 0
  const laneTargets: Map<number, number> | null = targeting
    ? targets.length === 1
      ? collapseTo(r, targets[0])
      : distributeAcross(r, targets)
    : null

  const out: NotePlacement[] = []
  for (let copy = 0; copy < copies; copy++) {
    const offset = copy * oneCycle
    for (let li = 0; li < r.lanes.length; li++) {
      const lane = r.lanes[li]
      // Targeted: use the override pitch for this lane (or skip it if the lane
      // wasn't selected by the heuristic). Untargeted: the natural role pitch.
      let pitch: number
      if (laneTargets) {
        const t = laneTargets.get(li)
        if (t == null) continue // lane not assigned a target → drop it
        pitch = t
      } else {
        pitch = pitchForRole(lane.role)
      }
      for (const hit of lane.hits) {
        const tick = offset + hit.cell * ct
        if (tick >= loop) continue // truncate a partial trailing cycle
        out.push({
          tick,
          pitch,
          velocity: clamp01(hitVelocity(lane, hit) * intensity),
          ...(hit.ratchet && hit.ratchet > 1 ? { ratchet: hit.ratchet } : {}),
        })
      }
    }
  }

  // Targeting can route two lanes onto the same pitch+tick (collapse always
  // does; distribute can on overlapping onsets). De-dupe by (tick, pitch),
  // keeping the LOUDER hit so accents survive.
  if (laneTargets) return dedupeKeepLoudest(out)

  out.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch)
  return out
}

// ----------------------------------------------------------- targeting heuristics
/**
 * COLLAPSE — point the whole rhythm at one voice. Every lane is mapped to the
 * single target pitch, so unioning their onsets (the de-dupe in applyRhythm)
 * produces one merged pattern on that voice. A clave's 3-2 stabs, a samba's
 * surdo + caixa + tamborim, etc. all fold onto, say, the kick.
 */
const collapseTo = (r: Rhythm, pitch: number): Map<number, number> => {
  const m = new Map<number, number>()
  for (let i = 0; i < r.lanes.length; i++) m.set(i, pitch)
  return m
}

/**
 * DISTRIBUTE — spread the rhythm across N selected voices. We RANK lanes by
 * importance, take the top N, and assign them in order to the N target pitches
 * (target[0] gets the most important lane). Importance ranking:
 *   1. SIGNATURE lanes first (the clave / surdo / tala backbone defines the
 *      groove, so it should land on the first selected voice).
 *   2. then by HIT DENSITY (more onsets ⇒ more musically load-bearing), using
 *      total accent-weighted velocity as the tiebreak (louder lane wins).
 *   3. stable by original lane order for full ties (reproducible).
 * If the rhythm has fewer lanes than targets, the extra targets simply go
 * unused (no empty lanes invented).
 */
const distributeAcross = (r: Rhythm, pitches: number[]): Map<number, number> => {
  const ranked = r.lanes
    .map((lane, idx) => ({
      idx,
      signature: lane.signature ? 1 : 0,
      hits: lane.hits.length,
      weight: lane.hits.reduce((s, h) => s + hitVelocity(lane, h), 0) || laneVelocity(lane),
    }))
    .sort(
      (a, b) =>
        b.signature - a.signature ||
        b.hits - a.hits ||
        b.weight - a.weight ||
        a.idx - b.idx
    )
  const m = new Map<number, number>()
  const n = Math.min(pitches.length, ranked.length)
  for (let k = 0; k < n; k++) m.set(ranked[k].idx, pitches[k])
  return m
}

/** De-dupe placements by (tick, pitch), keeping the louder of any collision. */
const dedupeKeepLoudest = (placements: NotePlacement[]): NotePlacement[] => {
  const best = new Map<string, NotePlacement>()
  for (const p of placements) {
    const key = `${p.tick}:${p.pitch}`
    const cur = best.get(key)
    if (!cur || p.velocity > cur.velocity) best.set(key, p)
  }
  return [...best.values()].sort((a, b) => a.tick - b.tick || a.pitch - b.pitch)
}

// ================================================================ scatterRhythm
export interface ScatterOptions {
  /** Loop length to tile across, in ticks (defaults to the rhythm's own length). */
  loopTicks?: number
  /**
   * Overall density multiplier (0..1) applied to every step's derived
   * probability. 1 ⇒ the groove's natural profile; lower ⇒ sparser. Default 1.
   */
  density?: number
  /** Scale all chosen velocities (0..1). Default 1. */
  intensity?: number
}

/**
 * SCATTER — the founder's probabilistic spread. Given the kit voices the user
 * selected (one per "row") and a seeded RNG, walk EVERY row × EVERY step and
 * maybe place a hit there:
 *
 *   for row in rows:
 *     for step in steps:
 *       if rng() < profile[step].prob * density:
 *         place a hit at random velocity within profile[step]'s band
 *
 * The probability + velocity band come from the groove's SCATTER PROFILE (see
 * ./profile) — so a clave's onset steps fire often + loud and its rests rarely,
 * and the clave's *feel* gets sprinkled across all the selected rows, DIFFERENT
 * every press (the caller passes a fresh seed). Pure + seeded → testable; the
 * pattern tiles across the loop exactly like applyRhythm.
 *
 * `rowPitches` is the ordered list of selected kit pitches (each a row). Returns
 * concrete NotePlacements the caller maps to notes.
 */
export const scatterRhythm = (
  r: Rhythm,
  rowPitches: number[],
  rng: () => number,
  opts: ScatterOptions = {}
): NotePlacement[] => {
  const rows = rowPitches.filter((p) => Number.isFinite(p))
  if (rows.length === 0) return []
  const ct = cellTicks(r)
  const oneCycle = rhythmTicks(r)
  if (oneCycle <= 0) return []
  const cells = rhythmCells(r)
  const loop = Math.max(oneCycle, Math.round(opts.loopTicks ?? oneCycle))
  const density = clamp01(opts.density == null ? 1 : opts.density)
  const intensity = opts.intensity == null ? 1 : Math.max(0, opts.intensity)
  const profile = grooveProfile(r)

  const fullCopies = Math.floor(loop / oneCycle)
  const tailTicks = loop - fullCopies * oneCycle
  const copies = fullCopies + (tailTicks > 0 ? 1 : 0)

  const out: NotePlacement[] = []
  // Roll independently per (row, copy, cell) so each row gets its OWN spread and
  // the same groove never lands identically on two rows.
  for (let ri = 0; ri < rows.length; ri++) {
    const pitch = rows[ri]
    for (let copy = 0; copy < copies; copy++) {
      const offset = copy * oneCycle
      for (let c = 0; c < cells; c++) {
        const tick = offset + c * ct
        if (tick >= loop) continue // truncate a partial trailing cycle
        const step = profile[c]
        if (rng() >= step.prob * density) continue // didn't fire this step
        // Random velocity within the step's emphasis band (accents loud, ghosts
        // quiet), then scaled by intensity.
        const band = step.velMax - step.velMin
        const vel = step.velMin + rng() * (band > 0 ? band : 0)
        out.push({ tick, pitch, velocity: clamp01(vel * intensity) })
      }
    }
  }
  // A row can never collide with itself (one roll per cell), but de-dupe defends
  // future callers; keep the louder.
  return dedupeKeepLoudest(out)
}

// ============================================================= scatterPhrases
export interface ScatterPhrasesOptions {
  loopTicks?: number
  /** Overall density multiplier (0..1) on each step's probability. Default 0.6. */
  density?: number
  /**
   * The SELECTED snippet rows (indices into the bank) to put the groove on —
   * mirrors the drum scatter onto selected lanes. Each selected snippet gets its
   * OWN independent spread of the groove's profile across the loop (so the same
   * word can layer a clave while another word layers a different feel). When
   * empty/undefined: spread random bank snippets across the groove's onsets.
   */
  rows?: number[]
}

/**
 * The PHRASES analogue of scatterRhythm. Walk the groove's steps and place
 * snippets where the groove's PROFILE fires (clusters on onsets, sparse on
 * rests), at a random velocity in the step's emphasis band. With `rows` set, the
 * GROOVE is put on exactly those selected snippet rows (each its own spread);
 * without it, random bank snippets are spread across the onsets. Snippets are
 * placed at their NATURAL pitch — never semitone-shifted (the only phrase pitch
 * control is the live ribbon). Caller maps to `placeFragment`.
 */
export const scatterPhrases = (
  r: Rhythm,
  snippetCount: number,
  rng: () => number,
  opts: ScatterPhrasesOptions = {}
): PhrasePlacement[] => {
  if (snippetCount <= 0) return []
  const ct = cellTicks(r)
  const oneCycle = rhythmTicks(r)
  if (oneCycle <= 0) return []
  const cells = rhythmCells(r)
  const loop = Math.max(oneCycle, Math.round(opts.loopTicks ?? oneCycle))
  const density = clamp01(opts.density ?? 0.6)
  const profile = grooveProfile(r)

  const fullCopies = Math.floor(loop / oneCycle)
  const tailTicks = loop - fullCopies * oneCycle
  const copies = fullCopies + (tailTicks > 0 ? 1 : 0)

  // The rows to scatter onto. Selected rows (clamped to the bank) → the groove
  // lands on each; none → a single "any snippet" pass (random per onset).
  const selected = (opts.rows ?? []).filter((i) => i >= 0 && i < snippetCount)
  const useRows = selected.length > 0

  const out: PhrasePlacement[] = []
  // One pass per row (selected snippet), or a single pass that picks a random
  // snippet per onset when nothing is selected. Roll independently per (row,
  // copy, cell) so each row gets its own spread.
  const rowList = useRows ? selected : [-1]
  for (const row of rowList) {
    for (let copy = 0; copy < copies; copy++) {
      const offset = copy * oneCycle
      for (let c = 0; c < cells; c++) {
        const tick = offset + c * ct
        if (tick >= loop) continue
        const step = profile[c]
        if (rng() >= step.prob * density) continue
        const snippetIndex =
          row >= 0
            ? row
            : snippetCount === 1
              ? 0
              : randInt(rng, 0, snippetCount - 1)
        const band = step.velMax - step.velMin
        const vel = step.velMin + rng() * (band > 0 ? band : 0)
        out.push({ tick, snippetIndex, velocity: clamp01(vel) })
      }
    }
  }
  out.sort((a, b) => a.tick - b.tick)
  return out
}

// ========================================================= applyRhythmToPhrases
/** A phrase placement on a groove onset (caller maps to `placeFragment`).
 *  Phrases are spoken words — they are placed at their NATURAL pitch, NEVER
 *  semitone-shifted. The only pitch control for phrases is the live ribbon. */
export interface PhrasePlacement {
  tick: number
  /** Index into the passed `snippets` array. */
  snippetIndex: number
  velocity: number
}

export interface ApplyToPhrasesOptions {
  loopTicks?: number
  /** 0..1 — fraction of onsets that receive a phrase. Default 0.5. */
  density?: number
  /**
   * Which onsets to land phrases on: the union of these lanes' hit cells.
   * "signature" (default) uses the rhythm's backbone lanes — phrases land on
   * the clave/surdo/key pattern. "all" uses every lane's onsets.
   */
  onsetSource?: "signature" | "all"
}

/**
 * Distribute phrase snippets onto a groove's onsets so phrases fall on the
 * rhythm. Returns placements the caller maps to `placeFragment` events — at the
 * snippet's NATURAL pitch (no semitone shift, ever). Pure.
 */
export const applyRhythmToPhrases = (
  r: Rhythm,
  snippetCount: number,
  rng: () => number,
  opts: ApplyToPhrasesOptions = {}
): PhrasePlacement[] => {
  if (snippetCount <= 0) return []
  const ct = cellTicks(r)
  const oneCycle = rhythmTicks(r)
  if (oneCycle <= 0) return []
  const loop = Math.max(oneCycle, Math.round(opts.loopTicks ?? oneCycle))
  const density = clamp01(opts.density ?? 0.5)

  // Collect distinct onset cells from the chosen lanes.
  const useSignature = (opts.onsetSource ?? "signature") === "signature"
  const lanes = useSignature
    ? r.lanes.filter((l) => l.signature).length > 0
      ? r.lanes.filter((l) => l.signature)
      : r.lanes
    : r.lanes
  const onsetCells = new Set<number>()
  for (const l of lanes) for (const h of l.hits) onsetCells.add(h.cell)
  const cells = [...onsetCells].sort((a, b) => a - b)
  if (cells.length === 0) return []

  // Tile onsets across the loop, then keep a density-thinned subset.
  const fullCopies = Math.max(1, Math.ceil(loop / oneCycle))
  const ticks: number[] = []
  for (let copy = 0; copy < fullCopies; copy++) {
    const offset = copy * oneCycle
    for (const cell of cells) {
      const tick = offset + cell * ct
      if (tick < loop) ticks.push(tick)
    }
  }
  ticks.sort((a, b) => a - b)

  const keep = Math.max(1, Math.round(ticks.length * density))
  const chosen: number[] = []
  // Evenly stride through onsets, then jitter the choice with rng so reroll
  // produces a different (but reproducible) selection.
  const stride = ticks.length / keep
  for (let i = 0; i < keep; i++) {
    const base = Math.floor(i * stride)
    const jitter = randInt(rng, 0, Math.max(0, Math.floor(stride) - 1))
    const idx = Math.min(ticks.length - 1, base + jitter)
    chosen.push(ticks[idx])
  }
  // Dedup (jitter can collide) while preserving order.
  const seen = new Set<number>()
  const uniqueTicks = chosen.filter((t) => (seen.has(t) ? false : (seen.add(t), true)))

  const out: PhrasePlacement[] = []
  for (let i = 0; i < uniqueTicks.length; i++) {
    const snippetIndex = snippetCount === 1 ? 0 : randInt(rng, 0, snippetCount - 1)
    // Natural pitch — phrases are NEVER semitone-shifted on placement.
    out.push({ tick: uniqueTicks[i], snippetIndex, velocity: 0.9 })
  }
  out.sort((a, b) => a.tick - b.tick)
  return out
}

// ================================================================ varyRhythm
/**
 * Deep-ish clone a rhythm (the hits we may mutate are fresh arrays/objects so
 * the source corpus is never touched).
 */
const cloneRhythm = (r: Rhythm): Rhythm => ({
  ...r,
  lanes: r.lanes.map((l) => ({ ...l, hits: l.hits.map((h) => ({ ...h })) })),
  tags: r.tags ? [...r.tags] : undefined,
})

/** Is a hit part of the protected backbone (an accent on a signature lane)? */
const isBackbone = (lane: Lane, hit: Hit): boolean => Boolean(lane.signature && hit.accent)

/**
 * varyRhythm — keep the FLAVOR, make small changes. `amount` (0..1, small)
 * scales how many edits we make. We NEVER touch a signature lane's accented
 * backbone (the clave/surdo/tala stays recognisable); instead we:
 *   • add / drop GHOST notes on colour lanes,
 *   • nudge a few non-backbone hits by ±1 cell (within the grid),
 *   • jitter a few velocities slightly.
 * Seeded, so the same (rhythm, seed, amount) always yields the same variation.
 */
export const varyRhythm = (r: Rhythm, rng: () => number, amount = 0.25): Rhythm => {
  const out = cloneRhythm(r)
  out.id = `${r.id}~vary`
  const cells = rhythmCells(r)
  const a = clamp01(amount)
  // Number of edits scales with amount and pattern size (kept small).
  const edits = Math.max(1, Math.round(a * 6))

  // Indices of editable (non-backbone) hits across all lanes, plus colour lanes
  // we can add ghosts to.
  const occupied = (laneIdx: number): Set<number> =>
    new Set(out.lanes[laneIdx].hits.map((h) => h.cell))

  for (let e = 0; e < edits; e++) {
    const laneIdx = randInt(rng, 0, out.lanes.length - 1)
    const lane = out.lanes[laneIdx]
    const op = rng()

    if (op < 0.35) {
      // ADD a ghost note on a colour lane at a free cell.
      if (lane.signature && lane.hits.some((h) => h.accent)) continue
      const occ = occupied(laneIdx)
      const free: number[] = []
      for (let c = 0; c < cells; c++) if (!occ.has(c)) free.push(c)
      if (free.length === 0) continue
      const cell = pickOne(rng, free)
      lane.hits.push({ cell, ghost: true })
    } else if (op < 0.6) {
      // DROP a ghost / non-backbone hit.
      const droppable = lane.hits.filter((h) => !isBackbone(lane, h))
      if (droppable.length === 0) continue
      const victim = pickOne(rng, droppable)
      lane.hits = lane.hits.filter((h) => h !== victim)
    } else if (op < 0.85) {
      // NUDGE a non-backbone hit ±1 cell into a free slot.
      const movable = lane.hits.filter((h) => !isBackbone(lane, h))
      if (movable.length === 0) continue
      const hit = pickOne(rng, movable)
      const dir = rng() < 0.5 ? -1 : 1
      const target = hit.cell + dir
      if (target < 0 || target >= cells) continue
      if (lane.hits.some((h) => h !== hit && h.cell === target)) continue
      hit.cell = target
    } else {
      // JITTER a velocity slightly (any hit, backbone included — stays loud).
      if (lane.hits.length === 0) continue
      const hit = pickOne(rng, lane.hits)
      const base = hitVelocity(lane, hit)
      const delta = (rng() - 0.5) * 0.2
      hit.velocity = clamp01(base + delta)
    }
  }

  for (const lane of out.lanes) lane.hits.sort((h1, h2) => h1.cell - h2.cell)
  return out
}

// ================================================================ evolveRhythm
/**
 * evolveRhythm — iteratively vary so the groove drifts further while staying
 * musical: each generation is a vary step from the PREVIOUS generation (the
 * seed for auto-vary / auto-evolve). Backbone preservation compounds — because
 * every step protects the signature accents, even many generations keep the
 * key pattern. `amount` is the per-generation step size (kept small).
 */
export const evolveRhythm = (
  r: Rhythm,
  rng: () => number,
  generations = 4,
  amount = 0.2
): Rhythm => {
  let cur = r
  const gens = Math.max(1, Math.floor(generations))
  for (let g = 0; g < gens; g++) {
    cur = varyRhythm(cur, rng, amount)
  }
  return { ...cur, id: `${r.id}~evolve${gens}` }
}

// ============================================================== randomizeRhythm
export interface RandomizeOptions {
  /** Restrict the re-roll to one family; omit ⇒ the whole corpus. */
  family?: Rhythm["family"]
  /** After picking a base rhythm, apply this much vary on top (0 ⇒ pristine). */
  vary?: number
}

/**
 * randomizeRhythm — a full re-roll: pick a fresh rhythm from the corpus (within
 * a family, or anywhere), optionally varied. Seeded so reroll is reproducible.
 * Returns the chosen `Rhythm` (clone), so the caller can `applyRhythm` it.
 */
export const randomizeRhythm = (rng: () => number, opts: RandomizeOptions = {}): Rhythm => {
  const pool = opts.family ? RHYTHMS.filter((r) => r.family === opts.family) : RHYTHMS
  const source = pool.length > 0 ? pool : RHYTHMS
  const base = pickOne(rng, source)
  if (opts.vary && opts.vary > 0) {
    const v = varyRhythm(base, rng, opts.vary)
    return { ...v, id: `${base.id}~random` }
  }
  return cloneRhythm(base)
}
