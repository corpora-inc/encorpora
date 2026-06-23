/**
 * beatlounge — the AUTONOMOUS modulation engine.
 *
 * A single rAF loop that, each frame, reads the live doc, evaluates every
 * ENABLED modulator against a CONTINUOUS wall-clock time base, and writes the
 * resolved actual value onto the live node via `AudioGraph.applyParam`. It is
 * autonomous: the clock advances whether or not the transport is playing, so the
 * loop "evolves itself" even while stopped.
 *
 * Per modulator, per frame:
 *   cycleSec   = syncBeats ? syncBeats*(60/bpm) : (rateHz ? 1/rateHz : 1)
 *   totalPhase = t/cycleSec + (phase ?? 0)
 *   cycleIndex = floor(totalPhase);  phase01 = frac(totalPhase)
 *   s          = shapeValue(shape, phase01, cycleIndex, seed)   // -1..1
 *   value01    = clamp01(center + 0.5*depth*s)                  // normalized
 *   actual     = min + value01*(max-min)                        // range-mapped
 *   applyParam(target, actual)
 *
 * A `track.volume` modulator on a muted / not-audible track is SKIPPED (it would
 * fight mute/solo). The rAF only runs when ≥1 enabled modulator exists — we
 * subscribe to the bus and start/stop accordingly, so it costs nothing when idle.
 *
 * `now` is injectable for tests (a fake clock), as is `raf`/`caf`, so the
 * per-frame computation is exercised without a real rAF/AudioGraph.
 */

import type { CommandBus } from "../model/commandBus"
import type { AudioGraph } from "../contracts/engine"
import type { BeatloungeDoc, Modulator } from "../model/document"
import { findTrack, isTrackAudible } from "../model/document"
import { shapeValue } from "./shapes"
import { paramRange } from "./ranges"

export interface ModulationEngine {
  dispose(): void
}

export interface ModulationEngineDeps {
  bus: CommandBus
  graph: Pick<AudioGraph, "applyParam">
  /** Monotonic seconds source (injectable for tests). Defaults to perf/Date. */
  now?: () => number
  /** rAF scheduler (injectable for tests). Defaults to requestAnimationFrame. */
  raf?: (cb: () => void) => number
  /** rAF canceller (injectable for tests). Defaults to cancelAnimationFrame. */
  caf?: (handle: number) => void
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

const defaultNow = (): number => {
  const p = (globalThis as { performance?: { now(): number } }).performance
  if (p && typeof p.now === "function") return p.now() / 1000
  return Date.now() / 1000
}

const defaultRaf = (cb: () => void): number => {
  const f = (globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number })
    .requestAnimationFrame
  if (typeof f === "function") return f(() => cb())
  // Headless fallback (~60fps) so the loop still runs without a renderer.
  return setTimeout(cb, 16) as unknown as number
}

const defaultCaf = (handle: number): void => {
  const f = (globalThis as { cancelAnimationFrame?: (h: number) => void }).cancelAnimationFrame
  if (typeof f === "function") f(handle)
  else clearTimeout(handle as unknown as ReturnType<typeof setTimeout>)
}

/** The actual value one modulator resolves to at time `t` (seconds). Pure. */
export const evalModulator = (mod: Modulator, doc: BeatloungeDoc, t: number): number => {
  const bpm = doc.bpm > 0 ? doc.bpm : 120
  const cycleSec = mod.syncBeats
    ? mod.syncBeats * (60 / bpm)
    : mod.rateHz && mod.rateHz > 0
      ? 1 / mod.rateHz
      : 1
  const safeCycle = cycleSec > 0 ? cycleSec : 1
  const totalPhase = t / safeCycle + (mod.phase ?? 0)
  const cycleIndex = Math.floor(totalPhase)
  const phase01 = totalPhase - cycleIndex
  const s = shapeValue(mod.shape, phase01, cycleIndex, mod.seed ?? 0)
  const value01 = clamp01(mod.center + 0.5 * mod.depth * s)
  const { min, max } = paramRange(mod.target, doc)
  return min + value01 * (max - min)
}

/**
 * True if this modulator should be skipped THIS frame. We only suppress
 * `track.volume` modulators whose track is muted / not audible (so modulation
 * never fights the mixer's mute/solo); everything else always runs.
 */
const shouldSkip = (mod: Modulator, doc: BeatloungeDoc): boolean => {
  if (mod.target.scope === "track" && mod.target.param === "volume") {
    const track = findTrack(doc, mod.target.trackId)
    if (!track || !isTrackAudible(doc, track)) return true
  }
  return false
}

/** One frame: evaluate + apply every enabled modulator. Exported for tests. */
export const applyModulationFrame = (
  doc: BeatloungeDoc,
  t: number,
  graph: Pick<AudioGraph, "applyParam">
): void => {
  const mods = doc.modulators ?? []
  for (const mod of mods) {
    if (!mod.enabled) continue
    if (shouldSkip(mod, doc)) continue
    graph.applyParam(mod.target, evalModulator(mod, doc, t))
  }
}

const hasEnabled = (doc: BeatloungeDoc): boolean =>
  (doc.modulators ?? []).some((m) => m.enabled)

export const createModulationEngine = ({
  bus,
  graph,
  now = defaultNow,
  raf = defaultRaf,
  caf = defaultCaf,
}: ModulationEngineDeps): ModulationEngine => {
  let handle: number | null = null
  let disposed = false
  // Continuous time base: t0 anchors "now" so totalPhase is stable across the
  // session regardless of when the loop (re)starts.
  const t0 = now()

  const tick = () => {
    if (disposed) return
    const doc = bus.snapshot()
    applyModulationFrame(doc, now() - t0, graph)
    if (hasEnabled(doc)) {
      handle = raf(tick)
    } else {
      // No enabled modulators → stop spinning until one appears (bus sub restarts).
      handle = null
    }
  }

  const start = () => {
    if (disposed || handle !== null) return
    handle = raf(tick)
  }

  // Start/stop the loop in step with the doc: whenever a change leaves ≥1
  // enabled modulator and we're idle, kick the loop back on. The tick itself
  // stops the loop when none remain (cheap when idle).
  const unsub = bus.subscribe((doc) => {
    if (handle === null && hasEnabled(doc)) start()
  })

  // Kick once for the initial doc (handles a hydrated doc that already has mods).
  if (hasEnabled(bus.snapshot())) start()

  return {
    dispose() {
      disposed = true
      unsub()
      if (handle !== null) {
        caf(handle)
        handle = null
      }
    },
  }
}
