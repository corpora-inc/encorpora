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
import { hitVelocity, rhythmCells, type Hit, type Lane, type Rhythm } from "./types"
import { pitchForRole } from "./roles"
import { RHYTHMS } from "./corpus"

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
}

/**
 * Produce the concrete note placements for a drum track from a rhythm, tiled
 * across `loopTicks`. Pure; the caller maps these to `setNotes` inputs.
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

  const out: NotePlacement[] = []
  for (let copy = 0; copy < copies; copy++) {
    const offset = copy * oneCycle
    for (const lane of r.lanes) {
      const pitch = pitchForRole(lane.role)
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
  out.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch)
  return out
}

// ========================================================= applyRhythmToPhrases
/** A phrase placement on a groove onset (caller maps to `placeFragment`). */
export interface PhrasePlacement {
  tick: number
  /** Index into the passed `snippets` array. */
  snippetIndex: number
  /** -24..+24 semitones. Random or from the passed scale; 0 if none. */
  pitchSemis: number
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
  /** Pitch ladder (semitone offsets) to climb as phrases are placed; phrases
   *  step through it. Pass a scale here to keep them in key. Default [0]. */
  scale?: number[]
  /** True ⇒ pick scale degrees randomly instead of climbing the ladder. */
  randomPitch?: boolean
}

/**
 * Distribute phrase snippets onto a groove's onsets so phrases fall on the
 * rhythm. Returns placements the caller maps to `placeFragment` events. Pure +
 * decoupled from harmony (pitch is optional / passed in).
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
  const scale = opts.scale && opts.scale.length > 0 ? opts.scale : [0]

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
  let ladder = 0
  for (let i = 0; i < uniqueTicks.length; i++) {
    const snippetIndex = snippetCount === 1 ? 0 : randInt(rng, 0, snippetCount - 1)
    const pitchSemis = opts.randomPitch
      ? pickOne(rng, scale)
      : scale[ladder++ % scale.length]
    out.push({
      tick: uniqueTicks[i],
      snippetIndex,
      pitchSemis: Math.max(-24, Math.min(24, pitchSemis)),
      velocity: 0.9,
    })
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
