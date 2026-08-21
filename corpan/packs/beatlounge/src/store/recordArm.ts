/**
 * beatlounge — the PER-TRACK RECORD-ARM slice: ONE source of truth for which
 * tracks are armed to record, shared across every surface that can record (the
 * Instruments page header, the Shell DockRail button, the Ribbon widget /
 * immersive). Arm is keyed by trackId and lives in ONE module-scoped vanilla
 * zustand store (mirrors selectedGroove.ts / selectedInstrument.ts), so each
 * voice remembers its OWN arm; default is OFF; turning it off sticks for that
 * track only.
 *
 * SESSION-SCOPED (fixes #391): arm is sticky WITHIN a running session — it
 * survives switching voices and leaving/returning to a surface (the module
 * store outlives component unmount) — but it is held in memory only and is NOT
 * persisted. A full app reload/restart re-initialises the store to empty, so
 * you can never come back to a voice that is SILENTLY armed and quietly
 * overwriting your track. A record arm is (mildly) destructive; the safe
 * default is to start OFF every session.
 *
 * The bug this originally fixed: record-arm was transient `useState` — a single
 * shared flag on the Instruments page (so arming one synth bled onto every other
 * voice) plus a second local flag inside the ribbon. Turning it "off" never
 * reliably stuck, and switching synths showed the wrong arm.
 */

import { createStore } from "zustand/vanilla"
import { useStore } from "zustand"
import type { Id } from "../model/document"

interface RecordArmState {
  /** The set of armed track ids (membership = armed). */
  armed: Record<Id, true>
}

/**
 * The initial armed set for a fresh session: ALWAYS empty. Session-scoped by
 * design — nothing is read from storage, so a reload never rehydrates an arm.
 * Kept as a named seam so a fresh load and the test reset share one definition.
 */
const initialArmed = (): Record<Id, true> => ({})

const armStore = createStore<RecordArmState>(() => ({ armed: initialArmed() }))

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
}

/** Disarm every track (used when the whole song is replaced). */
export const disarmAllRecord = (): void => {
  if (Object.keys(armStore.getState().armed).length === 0) return
  armStore.setState({ armed: {} })
}

/**
 * The hook every record surface uses. Subscribes to THIS track's arm (selective
 * re-render) and returns a setter scoped to it. Default OFF; sticky within the
 * session, per track.
 */
export const useRecordArm = (
  trackId: Id | undefined
): { armed: boolean; setArmed: (on: boolean) => void } => {
  const armed = useStore(armStore, (s) => (trackId ? s.armed[trackId] === true : false))
  return { armed, setArmed: (on: boolean) => setRecordArmed(trackId, on) }
}

/**
 * Test seam: re-initialise the singleton to a fresh-session state (empty).
 * Simulates a full app reload so a test can prove arm never silently rehydrates.
 */
export const __resetRecordArmForTest = (): void => {
  armStore.setState({ armed: initialArmed() })
}
