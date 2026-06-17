/**
 * beatlounge — the SELECTED-INSTRUMENT slice: ONE source of truth for which
 * melodic track the Instruments page (and any future Home ribbon widget) is
 * bound to, keyed by document id so the selection survives leaving the page,
 * going Home, and coming back.
 *
 * Mirrors `transport.ts`: a module-scoped vanilla zustand store + a tiny hook.
 * The page used to keep this in `useState(initialTrackId)`, so navigating away
 * and back snapped you back to `instrumentTracks[0]`. Now the binding is global
 * and persistent for the session: pick a synth on the Instruments page, wander
 * off, return — same synth.
 *
 * The slice is PURE bookkeeping (a `Record<docId, trackId>`); it never imports
 * the store/doc write path. Resolution is a pure function the UI calls with the
 * live doc: stored id if it is still a melodic track, else the first melodic
 * track (so a vanished/renamed-away selection falls back gracefully). A future
 * Home ribbon widget binds to the SAME selection via `getSelectedInstrumentTrackId`.
 */

import { createStore } from "zustand/vanilla"
import { useStore } from "zustand"
import type { BeatloungeDoc, Id } from "../model/document"
import { isMelodicTrack } from "../modules/instruments/trackBinding"

interface SelectionState {
  /** docId → the chosen melodic track id (raw, may have since vanished). */
  byDoc: Record<string, Id>
}

const LS_KEY = "beatlounge:selectedInstrument"

/** Read the persisted docId→trackId map (graceful in SSR / private mode). */
const readPersisted = (): Record<string, Id> => {
  try {
    if (typeof localStorage === "undefined") return {}
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === "object" ? (parsed as Record<string, Id>) : {}
  } catch {
    return {}
  }
}

/** Persist the map (best-effort; the in-memory store still works if this fails). */
const writePersisted = (byDoc: Record<string, Id>): void => {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(byDoc))
  } catch {
    /* private mode / quota — ignore */
  }
}

/** Module singleton — one selection map per pack instance, hydrated from + written
 *  through to localStorage so the chosen synth survives a full reload / app restart
 *  (not just in-session navigation). The resolver validates the stored id against
 *  the live doc, so a vanished track falls back to the first melodic track. */
const selectionStore = createStore<SelectionState>(() => ({ byDoc: readPersisted() }))

/** The first melodic (non-drum) track of a doc, or undefined. */
const firstMelodicId = (doc: BeatloungeDoc): Id | undefined =>
  doc.tracks.find((t) => isMelodicTrack(t))?.id

/**
 * Resolve the bound melodic track for a doc: the stored id IF it is still a
 * melodic track, else the first melodic track (fallback on a vanished/renamed
 * selection), else undefined (no melodic track at all). Pure — pass the live doc.
 */
export const resolveSelectedInstrumentTrackId = (
  doc: BeatloungeDoc,
  stored: Id | undefined
): Id | undefined => {
  if (stored && doc.tracks.some((t) => t.id === stored && isMelodicTrack(t))) {
    return stored
  }
  return firstMelodicId(doc)
}

/** The raw stored id for a doc (may be stale), outside React. */
export const getStoredInstrumentTrackId = (docId: Id): Id | undefined =>
  selectionStore.getState().byDoc[docId]

/**
 * Decide what (if anything) the Instruments page should SEED its selection to on
 * mount. Pure so it's unit-testable. The persisted selection ALWAYS wins; the
 * mount's `requested` trackId is honored ONLY when there is no stored selection
 * AND it names a real melodic track. Returns the id to seed, or undefined to
 * leave the resolved (stored / first-melodic) selection untouched.
 *
 * (Bug it guards: the mount resolves `requested` to the FIRST melodic track, so
 * unconditionally seeding from it clobbered a persisted pick — re-entering the
 * page snapped back to track 1.)
 */
export const seedSelectionOnMount = (
  doc: BeatloungeDoc,
  stored: Id | undefined,
  requested: Id | undefined
): Id | undefined => {
  if (stored != null) return undefined // persisted selection wins
  if (requested && doc.tracks.some((t) => t.id === requested && isMelodicTrack(t))) {
    return requested
  }
  return undefined
}

/**
 * The RESOLVED selected melodic track id for a doc (stored-if-valid else first
 * melodic), outside React. The future Home ribbon widget binds to THIS so it
 * shows the same voice the Instruments page is on.
 */
export const getSelectedInstrumentTrackId = (doc: BeatloungeDoc): Id | undefined =>
  resolveSelectedInstrumentTrackId(doc, getStoredInstrumentTrackId(doc.id))

/** Record the chosen track for a doc (idempotent — no churn when unchanged). */
export const setSelectedInstrumentTrackId = (docId: Id, trackId: Id): void => {
  const cur = selectionStore.getState().byDoc[docId]
  if (cur === trackId) return
  selectionStore.setState((s) => {
    const byDoc = { ...s.byDoc, [docId]: trackId }
    writePersisted(byDoc) // durable: survives reload / app restart
    return { byDoc }
  })
}

/**
 * The hook the Instruments page (and the future Home ribbon) uses. Subscribes to
 * the slice (selective re-render) and resolves against the LIVE doc so the bound
 * id is always valid; `select(id)` records a new choice. Returns undefined only
 * when the doc has no melodic track.
 */
export const useSelectedInstrument = (
  doc: BeatloungeDoc
): { trackId: Id | undefined; select: (id: Id) => void } => {
  const stored = useStore(selectionStore, (s) => s.byDoc[doc.id])
  const trackId = resolveSelectedInstrumentTrackId(doc, stored)
  const select = (id: Id): void => setSelectedInstrumentTrackId(doc.id, id)
  return { trackId, select }
}

/** Test seam: reset the singleton (and clear persistence) between specs. */
export const __resetSelectedInstrumentForTest = (): void => {
  selectionStore.setState({ byDoc: {} })
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}
