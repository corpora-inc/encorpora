/**
 * beatlounge — the Zustand store wrapping the CommandBus.
 *
 * The bus is THE write path; this store is a thin reactive read-mirror over it
 * plus debounced IndexedDB persistence. Components select the doc and call
 * `dispatch` / `undo` / `redo` — never reduce or mutate the doc directly. The
 * store subscribes to the bus once and pushes every doc change into React.
 *
 * Persistence: any change that isn't a transient preview is debounced to IDB
 * (DB "beatlounge", store "songs", key "active"). Hydration is async via
 * `hydrateFromIdb()`, which calls `bus.load(doc)` if a saved doc exists.
 */

import { createStore, type StoreApi } from "zustand/vanilla"
import { useStore } from "zustand"
import type { Command } from "../model/command"
import type { ChangeMeta, CommandBus } from "../model/commandBus"
import type { BeatloungeDoc } from "../model/document"
import { saveActiveDoc, loadActiveDoc } from "./persistence"

const PERSIST_DEBOUNCE_MS = 500

export interface BeatloungeStoreState {
  doc: BeatloungeDoc
  canUndo: boolean
  canRedo: boolean
  /** Reflects the last bus change kind (for debugging / UI affordances). */
  lastChange: ChangeMeta["kind"] | null
  /** True once IDB hydration has settled (whether or not a doc was found). */
  hydrated: boolean
}

export interface BeatloungeStore {
  /** Vanilla zustand store (subscribe / getState outside React). */
  readonly vanilla: StoreApi<BeatloungeStoreState>
  /** The one write path. */
  dispatch(cmd: Command): BeatloungeDoc
  undo(): void
  redo(): void
  /** Async: load a persisted doc into the bus if present. */
  hydrateFromIdb(): Promise<void>
  /** Tear down the bus subscription + flush a pending save. */
  dispose(): void
}

/**
 * Build the store over an existing bus. The bus owns history; the store mirrors
 * its snapshot + undo/redo availability into reactive state.
 */
export const createBeatloungeStore = (bus: CommandBus): BeatloungeStore => {
  const vanilla = createStore<BeatloungeStoreState>(() => ({
    doc: bus.snapshot(),
    canUndo: bus.canUndo(),
    canRedo: bus.canRedo(),
    lastChange: null,
    hydrated: false,
  }))

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let pendingDoc: BeatloungeDoc | null = null

  const flushSave = () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (pendingDoc) {
      void saveActiveDoc(pendingDoc)
      pendingDoc = null
    }
  }

  const scheduleSave = (doc: BeatloungeDoc) => {
    pendingDoc = doc
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(flushSave, PERSIST_DEBOUNCE_MS)
  }

  const unsub = bus.subscribe((doc, meta) => {
    vanilla.setState({
      doc,
      canUndo: bus.canUndo(),
      canRedo: bus.canRedo(),
      lastChange: meta.kind,
    })
    // Persist committed states; never persist a transient preview frame.
    if (meta.kind !== "preview" && meta.kind !== "preview-rollback") {
      scheduleSave(doc)
    }
  })

  return {
    vanilla,
    dispatch: (cmd) => bus.dispatch(cmd),
    undo: () => {
      bus.undo()
    },
    redo: () => {
      bus.redo()
    },
    async hydrateFromIdb() {
      const saved = await loadActiveDoc()
      if (saved) bus.load(saved)
      vanilla.setState({
        doc: bus.snapshot(),
        canUndo: bus.canUndo(),
        canRedo: bus.canRedo(),
        hydrated: true,
      })
    },
    dispose() {
      unsub()
      flushSave()
    },
  }
}

/** React hook: subscribe to a slice of the store with a selector. */
export const useBeatloungeStore = <T>(
  store: BeatloungeStore,
  selector: (s: BeatloungeStoreState) => T
): T => useStore(store.vanilla, selector)
