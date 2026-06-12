/**
 * beatlounge — the AUTO-MELODY slice: per-track configuration for the always-on
 * generative conductor (the "Auto melody expansion" feature), keyed by track id
 * so an armed line keeps jamming after you leave the Instruments screen, go to
 * the Stage, or reload the app.
 *
 * Structurally mirrors `selectedInstrument.ts`: a module-scoped vanilla zustand
 * store + localStorage persistence + a tiny React hook. PURE bookkeeping — it
 * never imports the doc write path. The rig-level conductor polls this slice
 * (`listArmedTracks` / `subscribeAuto`) and writes generated notes through the
 * store's preview seam; the Score editor reads + edits it via `useAutoConfig`.
 *
 * Each track's config carries the engine knobs surfaced behind the Auto chip:
 * Feel (metricId), Motion (tableId), Density, and the headline Variation seed
 * policy (lock / evolve / new). Stale metric/table ids (corpus edits between
 * sessions) are repaired to the [0] default on read so we never crash or generate
 * against a vanished profile.
 */

import { createStore } from "zustand/vanilla"
import { useStore } from "zustand"
import type { Id } from "../model/document"
import { METRIC_PROFILES, TRANSITION_TABLES } from "../music/melody"

export type AutoVariation = "lock" | "evolve" | "new"

export interface AutoTrackConfig {
  /** Armed: when on AND the transport is playing, the conductor regenerates
   *  this track each loop wrap. */
  on: boolean
  /** A METRIC_PROFILES id (Feel). Default METRIC_PROFILES[0].id. */
  metricId: string
  /** A TRANSITION_TABLES id (Motion). Default TRANSITION_TABLES[0].id. */
  tableId: string
  /** 0..1 onset density. Default 0.55 (the engine's documented GenerateOpts default). */
  density: number
  /** Seed policy. Default "evolve" (gradual mutation each wrap). */
  variation: AutoVariation
  /** Stable seed for variation:"lock"; rolled once when first needed. */
  lockSeed: number
}

interface AutoState {
  /** trackId → its Auto config. */
  byTrack: Record<string, AutoTrackConfig>
}

const LS_KEY = "beatlounge:autoMelody"

/** The [0] default ids — the validate-on-read fallback for stale metric/table ids. */
const DEFAULT_METRIC_ID = METRIC_PROFILES[0]?.id ?? ""
const DEFAULT_TABLE_ID = TRANSITION_TABLES[0]?.id ?? ""
const DEFAULT_DENSITY = 0.55
const DEFAULT_VARIATION: AutoVariation = "evolve"

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

/** A fresh random seed (the conductor's variation:"new" / first-roll source). */
const rollSeed = (): number => (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0

/** The resolved defaults for an absent track. */
const defaultConfig = (): AutoTrackConfig => ({
  on: false,
  metricId: DEFAULT_METRIC_ID,
  tableId: DEFAULT_TABLE_ID,
  density: DEFAULT_DENSITY,
  variation: DEFAULT_VARIATION,
  lockSeed: 0,
})

/** Repair one (possibly stale / partial) stored entry into a valid config.
 *  Unknown metric/table ids fall back to the [0] default; density clamps. */
const sanitize = (raw: unknown): AutoTrackConfig => {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<AutoTrackConfig>
  const metricId =
    typeof r.metricId === "string" && METRIC_PROFILES.some((m) => m.id === r.metricId)
      ? r.metricId
      : DEFAULT_METRIC_ID
  const tableId =
    typeof r.tableId === "string" && TRANSITION_TABLES.some((t) => t.id === r.tableId)
      ? r.tableId
      : DEFAULT_TABLE_ID
  const variation: AutoVariation =
    r.variation === "lock" || r.variation === "evolve" || r.variation === "new"
      ? r.variation
      : DEFAULT_VARIATION
  return {
    on: r.on === true,
    metricId,
    tableId,
    density: typeof r.density === "number" && Number.isFinite(r.density) ? clamp01(r.density) : DEFAULT_DENSITY,
    variation,
    lockSeed: typeof r.lockSeed === "number" && Number.isFinite(r.lockSeed) ? r.lockSeed >>> 0 : 0,
  }
}

/** Read the persisted trackId→config map (graceful in SSR / private mode). */
const readPersisted = (): Record<string, AutoTrackConfig> => {
  try {
    if (typeof localStorage === "undefined") return {}
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    const out: Record<string, AutoTrackConfig> = {}
    for (const [trackId, entry] of Object.entries(parsed as Record<string, unknown>)) {
      out[trackId] = sanitize(entry)
    }
    return out
  } catch {
    return {}
  }
}

/** Persist the map (best-effort; the in-memory store still works if this fails). */
const writePersisted = (byTrack: Record<string, AutoTrackConfig>): void => {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(byTrack))
  } catch {
    /* private mode / quota — ignore */
  }
}

/** Module singleton — one Auto-config map per pack instance, hydrated from +
 *  written through to localStorage so armed state survives a full reload. */
const autoStore = createStore<AutoState>(() => ({ byTrack: readPersisted() }))

/**
 * Resolved config for a track (defaults applied; the stored entry is already
 * sanitized on read). Pure — safe outside React.
 */
export const getAutoConfig = (trackId: Id): AutoTrackConfig =>
  autoStore.getState().byTrack[trackId] ?? defaultConfig()

/** Internal: commit a config patch for a track, idempotent (bails when equal). */
const writeConfig = (trackId: Id, next: AutoTrackConfig): void => {
  const cur = autoStore.getState().byTrack[trackId] ?? defaultConfig()
  if (
    cur.on === next.on &&
    cur.metricId === next.metricId &&
    cur.tableId === next.tableId &&
    cur.density === next.density &&
    cur.variation === next.variation &&
    cur.lockSeed === next.lockSeed
  ) {
    return // unchanged — no churn, no persist
  }
  autoStore.setState((s) => {
    const byTrack = { ...s.byTrack, [trackId]: next }
    writePersisted(byTrack)
    return { byTrack }
  })
}

/** Arm / disarm a track (idempotent). Rolls a lockSeed lazily the first time a
 *  track is armed so variation:"lock" has a stable seed to reuse. */
export const setAutoArmed = (trackId: Id, on: boolean): void => {
  const cur = getAutoConfig(trackId)
  const lockSeed = on && cur.lockSeed === 0 ? rollSeed() : cur.lockSeed
  writeConfig(trackId, { ...cur, on, lockSeed })
}

/** Patch any option(s) for a track (idempotent); persists. lockSeed is internal. */
export const setAutoOption = (
  trackId: Id,
  patch: Partial<Omit<AutoTrackConfig, "lockSeed">>
): void => {
  const cur = getAutoConfig(trackId)
  // Validate ids on write too (defensive — the UI only feeds valid ids): an
  // unknown metric/table id is dropped so the config never holds a stale id.
  const metricId =
    patch.metricId != null && METRIC_PROFILES.some((m) => m.id === patch.metricId)
      ? patch.metricId
      : cur.metricId
  const tableId =
    patch.tableId != null && TRANSITION_TABLES.some((t) => t.id === patch.tableId)
      ? patch.tableId
      : cur.tableId
  const next: AutoTrackConfig = {
    ...cur,
    ...patch,
    metricId,
    tableId,
    density: patch.density != null ? clamp01(patch.density) : cur.density,
  }
  writeConfig(trackId, next)
}

/** Every armed trackId (on === true) — the conductor's poll source, outside React. */
export const listArmedTracks = (): Id[] => {
  const { byTrack } = autoStore.getState()
  const out: Id[] = []
  for (const [trackId, cfg] of Object.entries(byTrack)) {
    if (cfg.on) out.push(trackId)
  }
  return out
}

/** Subscribe outside React (the conductor reacts to fresh arming). */
export const subscribeAuto = (cb: () => void): (() => void) => autoStore.subscribe(cb)

/**
 * The hook the Score editor uses: subscribes to THIS track's config (selective
 * re-render) and returns it plus `arm` / `setOption` writers.
 */
export const useAutoConfig = (
  trackId: Id
): AutoTrackConfig & {
  arm: (on: boolean) => void
  setOption: (patch: Partial<Omit<AutoTrackConfig, "lockSeed">>) => void
} => {
  const cfg = useStore(autoStore, (s) => s.byTrack[trackId]) ?? defaultConfig()
  return {
    ...cfg,
    arm: (on: boolean) => setAutoArmed(trackId, on),
    setOption: (patch) => setAutoOption(trackId, patch),
  }
}

/** Test seam: reset the singleton (and clear persistence) between specs. */
export const __resetAutoMelodyForTest = (): void => {
  autoStore.setState({ byTrack: {} })
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}
