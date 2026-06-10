/**
 * beatlounge — the command bus. The single write surface over the document.
 *
 * Every source (UI gesture, LLM tool call, phrase-sampler) dispatches a
 * Command here. The bus applies the pure reducer, maintains a snapshot-based
 * undo/redo stack (cheap thanks to structural sharing), supports transient
 * `preview` (apply → keep or rollback), and exposes a read-only `snapshot`
 * for serializing the grid to the LLM. Subscribers (store, audioGraph,
 * scheduler) react to doc changes.
 */

import type { Command } from "./command"
import type { BeatloungeDoc } from "./document"
import { reduce } from "./reduce"

export interface CommandBus {
  /** Apply a command, push undo, notify subscribers. Returns the new doc. */
  dispatch(cmd: Command): BeatloungeDoc
  /** Apply transiently. Returns a controller to keep (commit) or undo (rollback). */
  preview(cmd: Command): PreviewHandle
  undo(): BeatloungeDoc | null
  redo(): BeatloungeDoc | null
  canUndo(): boolean
  canRedo(): boolean
  /** Read-only current document. */
  snapshot(): BeatloungeDoc
  /** Replace the whole document (load/import). Clears history. */
  load(doc: BeatloungeDoc): void
  subscribe(cb: (doc: BeatloungeDoc, meta: ChangeMeta) => void): () => void
}

export interface PreviewHandle {
  /** Commit the preview onto the undo stack. */
  keep(): BeatloungeDoc
  /** Discard the preview, restoring the prior document. */
  rollback(): BeatloungeDoc
}

export interface ChangeMeta {
  /** "dispatch" | "undo" | "redo" | "preview" | "preview-rollback" | "load". */
  kind: ChangeKind
  command?: Command
}

export type ChangeKind =
  | "dispatch"
  | "undo"
  | "redo"
  | "preview"
  | "preview-keep"
  | "preview-rollback"
  | "load"

const MAX_HISTORY = 200
const now = (): number => {
  // Date.now is fine in pack runtime; guarded for SSR/test determinism.
  try {
    return Date.now()
  } catch {
    return 0
  }
}

export const createCommandBus = (initial: BeatloungeDoc): CommandBus => {
  let doc = initial
  let undoStack: BeatloungeDoc[] = []
  let redoStack: BeatloungeDoc[] = []
  const subs = new Set<(doc: BeatloungeDoc, meta: ChangeMeta) => void>()

  const notify = (meta: ChangeMeta) => {
    for (const cb of subs) cb(doc, meta)
  }

  const commit = (next: BeatloungeDoc, cmd: Command) => {
    if (next === doc) return doc // no-op command produced no change
    undoStack.push(doc)
    if (undoStack.length > MAX_HISTORY) undoStack.shift()
    redoStack = []
    doc = { ...next, updatedAt: now() }
    notify({ kind: "dispatch", command: cmd })
    return doc
  }

  return {
    dispatch(cmd) {
      return commit(reduce(doc, cmd), cmd)
    },

    preview(cmd) {
      const before = doc
      const next = reduce(doc, cmd)
      doc = next === before ? before : { ...next, updatedAt: now() }
      notify({ kind: "preview", command: cmd })
      let settled = false
      return {
        keep() {
          if (settled) return doc
          settled = true
          if (doc !== before) {
            undoStack.push(before)
            if (undoStack.length > MAX_HISTORY) undoStack.shift()
            redoStack = []
          }
          notify({ kind: "preview-keep", command: cmd })
          return doc
        },
        rollback() {
          if (settled) return doc
          settled = true
          doc = before
          notify({ kind: "preview-rollback", command: cmd })
          return doc
        },
      }
    },

    undo() {
      const prev = undoStack.pop()
      if (!prev) return null
      redoStack.push(doc)
      doc = prev
      notify({ kind: "undo" })
      return doc
    },

    redo() {
      const next = redoStack.pop()
      if (!next) return null
      undoStack.push(doc)
      doc = next
      notify({ kind: "redo" })
      return doc
    },

    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    snapshot: () => doc,

    load(next) {
      doc = next
      undoStack = []
      redoStack = []
      notify({ kind: "load" })
    },

    subscribe(cb) {
      subs.add(cb)
      return () => {
        subs.delete(cb)
      }
    },
  }
}
