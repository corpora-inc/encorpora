/**
 * beatlounge — the SHARED SELECTED-GROOVE slice: ONE source of truth for which
 * world rhythm the +/− generator operates on, shared across the home Drums widget,
 * the Drums pane, and the Grooves panel.
 *
 * The bug this fixes: each surface kept its OWN local `useState(rhythmId)` (the
 * home widget rolled a random one; the Grooves panel defaulted to RHYTHMS[0] /
 * son-clave), so picking a groove in one place did NOT reflect in another, and
 * the dial densified whatever each surface happened to be holding. Now there is
 * exactly ONE selected-groove id, in a module-scoped vanilla zustand store
 * (mirrors transport.ts / selectedInstrument.ts), persisted to localStorage so it
 * survives a reload — and every surface binds to it.
 *
 * DEFAULT is RANDOM (never "the first"/son-clave): on first use we lazily roll a
 * random groove and persist it, so a fresh session starts somewhere musical, not
 * always the same key pattern.
 *
 * Pure bookkeeping (a single id). It never imports the doc write path; the dial
 * actions read the id and drive the generator.
 */

import { createStore } from "zustand/vanilla"
import { useStore } from "zustand"
import { RHYTHMS } from "../rhythm"
import { pickRandomRhythmId } from "../modules/grooves/randomRhythm"

interface SelectedGrooveState {
  /** The chosen world-rhythm id, or null until first resolved. */
  rhythmId: string | null
}

const LS_KEY = "beatlounge:selectedGroove"

/** Read the persisted id from localStorage (graceful in SSR / private mode). */
const readPersisted = (): string | null => {
  try {
    if (typeof localStorage === "undefined") return null
    const id = localStorage.getItem(LS_KEY)
    // Only honour an id that still exists in the corpus.
    return id && RHYTHMS.some((r) => r.id === id) ? id : null
  } catch {
    return null
  }
}

/** Persist the id (best-effort). */
const writePersisted = (id: string): void => {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LS_KEY, id)
  } catch {
    /* private mode / quota — ignore, the in-memory store still works */
  }
}

const grooveStore = createStore<SelectedGrooveState>(() => ({
  rhythmId: readPersisted(),
}))

/**
 * Resolve the selected groove id, rolling + persisting a RANDOM one on first use
 * (never "the first"). Pass an `rng` (defaults to Math.random) for the initial
 * roll so it's testable. Idempotent: once set it sticks until `selectGroove`.
 */
export const ensureSelectedGroove = (rng: () => number = Math.random): string => {
  const cur = grooveStore.getState().rhythmId
  if (cur && RHYTHMS.some((r) => r.id === cur)) return cur
  const id = pickRandomRhythmId(rng)
  grooveStore.setState({ rhythmId: id })
  writePersisted(id)
  return id
}

/** The current selected id WITHOUT rolling a default (may be null). */
export const peekSelectedGroove = (): string | null => grooveStore.getState().rhythmId

/** Record a new selected groove (idempotent — no churn when unchanged). */
export const selectGroove = (id: string): void => {
  if (!id || !RHYTHMS.some((r) => r.id === id)) return
  if (grooveStore.getState().rhythmId === id) return
  grooveStore.setState({ rhythmId: id })
  writePersisted(id)
}

/**
 * The hook every groove surface uses. Subscribes to the single id (selective
 * re-render), resolving a random default on first read so the UI always has a
 * groove, and returns `select` to change it everywhere at once.
 */
export const useSelectedGroove = (): { rhythmId: string; select: (id: string) => void } => {
  const stored = useStore(grooveStore, (s) => s.rhythmId)
  const rhythmId = stored && RHYTHMS.some((r) => r.id === stored) ? stored : ensureSelectedGroove()
  return { rhythmId, select: selectGroove }
}

/** Test seam: reset the singleton (and clear persistence) between specs. */
export const __resetSelectedGrooveForTest = (): void => {
  grooveStore.setState({ rhythmId: null })
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}
