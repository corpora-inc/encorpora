/**
 * beatlounge — the PER-TRACK RECORD-ARM slice: ONE source of truth for which
 * tracks are armed to record, shared across every surface that can record (the
 * Instruments page header, the Ribbon widget/immersive) and PERSISTED so the
 * arm is sticky — it survives switching voices, leaving the page, and a reload.
 *
 * The bug this fixes: record-arm was transient `useState` — a single shared flag
 * on the Instruments page (so arming one synth bled onto every other voice) plus
 * a second local flag inside the ribbon. Turning it "off" never reliably stuck,
 * and switching synths showed the wrong arm. Now arm is keyed by trackId, lives
 * in one module-scoped vanilla zustand store (mirrors selectedGroove.ts /
 * selectedInstrument.ts), and is persisted to localStorage. Each voice remembers
 * its OWN arm; default is OFF; turning it off sticks for that track only.
 */

import { createStore } from "zustand/vanilla"
import { useStore } from "zustand"
import type { Id } from "../model/document"

interface RecordArmState {
  /** The set of armed track ids (membership = armed). */
  armed: Record<Id, true>
}

const LS_KEY = "beatlounge:recordArm"

/** Read the persisted armed-id set (graceful in SSR / private mode). */
const readPersisted = (): Record<Id, true> => {
  try {
    if (typeof localStorage === "undefined") return {}
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const ids = JSON.parse(raw) as unknown
    if (!Array.isArray(ids)) return {}
    const out: Record<Id, true> = {}
    for (const id of ids) if (typeof id === "string") out[id] = true
    return out
  } catch {
    return {}
  }
}

/** Persist the armed-id set (best-effort). */
const writePersisted = (armed: Record<Id, true>): void => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LS_KEY, JSON.stringify(Object.keys(armed)))
    }
  } catch {
    /* private mode / quota — in-memory store still works */
  }
}

const armStore = createStore<RecordArmState>(() => ({ armed: readPersisted() }))

/** Is this track armed to record? (false for an unknown/undefined id) */
export const isRecordArmed = (trackId: Id | undefined): boolean =>
  !!trackId && armStore.getState().armed[trackId] === true

/** Arm / disarm ONE track (idempotent — no churn when unchanged). */
export const setRecordArmed = (trackId: Id | undefined, on: boolean): void => {
  if (!trackId) return
  const cur = armStore.getState().armed
  if ((cur[trackId] === true) === on) return
  const next = { ...cur }
  if (on) next[trackId] = true
  else delete next[trackId]
  armStore.setState({ armed: next })
  writePersisted(next)
}

/** Disarm every track (used when the whole song is replaced). */
export const disarmAllRecord = (): void => {
  if (Object.keys(armStore.getState().armed).length === 0) return
  armStore.setState({ armed: {} })
  writePersisted({})
}

/**
 * The hook every record surface uses. Subscribes to THIS track's arm (selective
 * re-render) and returns a setter scoped to it. Default OFF; sticky + persisted.
 */
export const useRecordArm = (
  trackId: Id | undefined
): { armed: boolean; setArmed: (on: boolean) => void } => {
  const armed = useStore(armStore, (s) => (trackId ? s.armed[trackId] === true : false))
  return { armed, setArmed: (on: boolean) => setRecordArmed(trackId, on) }
}
