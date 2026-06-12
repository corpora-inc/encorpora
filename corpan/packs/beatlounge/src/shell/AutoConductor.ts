/**
 * beatlounge — the AUTO CONDUCTOR: the rig-level, always-on generative engine
 * behind the Auto chip ("Auto melody expansion").
 *
 * It mounts ONCE in App.buildRig() (the single long-lived rig), so an armed
 * melody keeps regenerating after you leave the Instruments screen, go to the
 * Stage, or open the immersive drawer — the conductor outlives every screen and
 * dies only with the rig. (Score's old per-component useEffect died the moment
 * you navigated away; this is the fix.)
 *
 * Per loop wrap, for every armed + melodic track it re-walks a fresh line via
 * `buildAutoPlayNotes` and writes it through `store.preview()` WITHOUT keep() —
 * each wrap re-bases on the current doc and supersedes the last, so a forever-
 * regenerating line leaves the undo stack and debounced IDB completely untouched
 * (the old `store.dispatch` per wrap spammed one undo frame per loop). The
 * Variation seed policy (lock / evolve / new) picks the per-wrap seed; the seed
 * is salted by a trackId hash so two tracks on the same Feel/Motion de-correlate.
 *
 * Gated strictly on `audio.isPlaying()`: a stopped transport is silent and
 * writes nothing. Arming reactively seeds ONE immediate fill (so arming mid-loop
 * is audible); option edits land on the next wrap (no thrash). A globalThis
 * idempotency guard survives StrictMode double-mount / hot-reload — a second
 * createAutoConductor disposes the prior singleton.
 */

import type { AudioFacade } from "../contracts/audioFacade"
import type { BeatloungeStore } from "../store/store"
import type { Id, Tick } from "../model/document"
import { findTrack, isInstrumentTrack } from "../model/document"
import { isMelodicTrack } from "../modules/instruments/trackBinding"
import {
  METRIC_PROFILES,
  TRANSITION_TABLES,
  type MetricProfile,
  type TransitionTable,
} from "../music/melody"
import { buildAutoPlayNotes } from "../modules/score/scoreModel"
import {
  getAutoConfig,
  listArmedTracks,
  subscribeAuto,
  type AutoTrackConfig,
} from "../store/autoMelody"

/** ~2 octaves around the working tonic — matches the Score editor. */
const OCTAVES = 2

/** The splitmix64 odd-increment constant (same one scoreModel.ts uses to fan
 *  out per-layer seeds) — used to advance the seed one step per wrap for
 *  variation:"evolve". */
const SEED_STEP = 0x9e3779b1

/** Cheap, stable 32-bit hash of a trackId so two armed tracks on identical
 *  Feel/Motion generate DIFFERENT lines (per-track seed de-correlation). */
const hashTrackId = (id: Id): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** A fresh random seed for variation:"new". */
const rollSeed = (): number => (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0

export interface AutoConductor {
  dispose(): void
}

export interface AutoConductorDeps {
  store: BeatloungeStore
  audio: AudioFacade
}

interface ConductorGlobal {
  __blAutoConductor?: AutoConductor
}

/**
 * Build the rig-level auto conductor. Idempotent: a second call disposes the
 * prior singleton (the StrictMode / hot-reload double-mount hazard) so there is
 * never a second playhead subscription writing twice per wrap.
 */
export const createAutoConductor = (deps: AutoConductorDeps): AutoConductor => {
  const g = globalThis as unknown as ConductorGlobal
  // Replace any prior live conductor (double-mount): dispose it first.
  if (g.__blAutoConductor) {
    try {
      g.__blAutoConductor.dispose()
    } catch {
      /* the prior may already be torn down — ignore */
    }
    g.__blAutoConductor = undefined
  }

  const { store, audio } = deps
  let disposed = false
  let prevTick = -1
  /** The loop length we last saw — a change resets prevTick (avoid a mis-wrap). */
  let loopLen = store.vanilla.getState().doc.loopLengthTicks
  /** Per-track seed carried between wraps (for variation:"evolve" / "new"). */
  const lastSeed = new Map<string, number>()

  const resolveMetric = (id: string): MetricProfile =>
    METRIC_PROFILES.find((m) => m.id === id) ?? METRIC_PROFILES[0]
  const resolveTable = (id: string): TransitionTable =>
    TRANSITION_TABLES.find((t) => t.id === id) ?? TRANSITION_TABLES[0]

  /** The seed for THIS wrap on THIS track, per the Variation policy + trackId salt. */
  const seedFor = (trackId: Id, cfg: AutoTrackConfig): number => {
    const salt = hashTrackId(trackId)
    if (cfg.variation === "lock") {
      // Reuse the stored lockSeed every wrap → identical ostinato.
      const base = cfg.lockSeed || lastSeed.get(trackId) || rollSeed()
      return (base ^ salt) >>> 0
    }
    const prior = lastSeed.get(trackId)
    let next: number
    if (cfg.variation === "evolve") {
      // Advance the prior seed one splitmix step → gradual mutation.
      const base = prior || cfg.lockSeed || rollSeed()
      next = (base + SEED_STEP) | 0
    } else {
      // "new" → a fresh random seed each wrap.
      next = rollSeed()
    }
    next = next >>> 0
    lastSeed.set(trackId, next)
    return (next ^ salt) >>> 0
  }

  /** Regenerate ONE armed track (skips vanished / non-melodic tracks). */
  const fillTrack = (trackId: Id): void => {
    const doc = store.vanilla.getState().doc
    const t = findTrack(doc, trackId)
    if (!t || !isInstrumentTrack(t) || !isMelodicTrack(t)) return
    const cfg = getAutoConfig(trackId)
    const notes = buildAutoPlayNotes(doc, {
      metric: resolveMetric(cfg.metricId),
      table: resolveTable(cfg.tableId),
      density: cfg.density,
      octaves: OCTAVES,
      seed: seedFor(trackId, cfg),
      grid: t.grid,
    })
    // Write transiently and DROP the handle — never keep(): no undo frame, no IDB.
    store.preview({ t: "setNotes", trackId, notes })
  }

  /** Regenerate every armed + melodic track for one loop wrap. */
  const regenerateAll = (): void => {
    for (const trackId of listArmedTracks()) fillTrack(trackId)
  }

  // ---- transport hook: one playhead subscription, loop-wrap detection -------
  const offPlayhead = audio.onPlayhead((tick: Tick) => {
    if (disposed) return // a late rAF callback after dispose() is a no-op

    // A loopLength change mid-play resets the wrap baseline (no spurious wrap).
    const curLen = store.vanilla.getState().doc.loopLengthTicks
    if (curLen !== loopLen) {
      loopLen = curLen
      prevTick = -1
    }

    if (!audio.isPlaying()) {
      // Stopped: nothing is generated; reset the baseline so the first wrap
      // after the next play isn't a false backward jump.
      prevTick = -1
      return
    }
    // Loop wrap = the playhead jumped backwards.
    const wrapped = prevTick >= 0 && tick < prevTick
    prevTick = tick
    if (wrapped) regenerateAll()
  })

  // ---- arming reactivity: seed an immediate fill on a NEW arming ------------
  let prevArmed = new Set(listArmedTracks())
  const offAuto = subscribeAuto(() => {
    if (disposed) return
    const now = new Set(listArmedTracks())
    // Newly-armed tracks get one immediate fill IF the transport is playing, so
    // arming mid-loop is audible without waiting for the next wrap.
    if (audio.isPlaying()) {
      for (const trackId of now) {
        if (!prevArmed.has(trackId)) fillTrack(trackId)
      }
    }
    // Forget seeds for tracks that disarmed (a fresh arm starts clean).
    for (const trackId of prevArmed) {
      if (!now.has(trackId)) lastSeed.delete(trackId)
    }
    prevArmed = now
  })

  const conductor: AutoConductor = {
    dispose() {
      if (disposed) return
      disposed = true
      try {
        offPlayhead()
      } catch {
        /* ignore */
      }
      try {
        offAuto()
      } catch {
        /* ignore */
      }
      lastSeed.clear()
      if (g.__blAutoConductor === conductor) g.__blAutoConductor = undefined
    },
  }
  g.__blAutoConductor = conductor
  return conductor
}
