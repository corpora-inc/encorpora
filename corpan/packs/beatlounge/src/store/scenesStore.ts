/**
 * beatlounge — the persisted SCENES slice.
 *
 * A Scene is a named, complete snapshot of a song's musical state (see
 * ../model/snapshot). Scenes are stored SEPARATELY from the live doc — in their
 * own IDB object store ("scenes"), keyed by `scenes:<docId>` — so the live doc
 * and its undo history stay lean (a heavy snapshot per command would bloat
 * memory + IDB). The whole list for a song is one IDB record (an array); songs
 * rarely have more than a few dozen scenes, so a single read/write is simplest
 * and avoids cursor ceremony.
 *
 * The LIST operations (add / rename / delete / sort) are pure and unit-tested;
 * the IDB read/write primitives degrade gracefully when IDB is absent
 * (SSR / private-mode / tests), noisy-not-silent on real failures.
 */

import type { SceneSnapshot } from "../model/snapshot"
import type { Id } from "../model/document"
import { newId } from "../model/ids"
import { getBeatloungeDb, SCENES_STORE as STORE } from "./db"

/** One saved Scene: a named, dated, complete musical snapshot. */
export interface Scene {
  id: Id
  /** User-facing name (default: "YYYY-MM-DD · word-word", editable). */
  name: string
  /** Epoch ms the scene was saved. */
  createdAt: number
  /** The captured musical state. */
  snapshot: SceneSnapshot
}

/** IDB key for a song's scene list. */
const keyFor = (docId: Id): string => `scenes:${docId}`

// ----------------------------------------------------------- pure list ops
// These never touch IDB; the store/UI calls them then persists the result.

/** Newest-first ordering (the list the UI renders). */
export const sortScenes = (scenes: readonly Scene[]): Scene[] =>
  scenes.slice().sort((a, b) => b.createdAt - a.createdAt)

/**
 * Build a new Scene from a snapshot + name + timestamp. `id` is generated unless
 * provided (tests pass a stable id). Pure.
 */
export const makeScene = (
  name: string,
  snapshot: SceneSnapshot,
  createdAt: number,
  id: Id = newId("scene")
): Scene => ({ id, name: name.trim() || name, createdAt, snapshot })

/** Add a scene to the list (returns a new array; does not mutate). */
export const addScene = (scenes: readonly Scene[], scene: Scene): Scene[] => [
  ...scenes,
  scene,
]

/** Rename a scene by id (empty/blank name is ignored → keeps the old name). */
export const renameScene = (
  scenes: readonly Scene[],
  id: Id,
  name: string
): Scene[] => {
  const next = name.trim()
  if (!next) return scenes.slice()
  let touched = false
  const out = scenes.map((s) => {
    if (s.id !== id || s.name === next) return s
    touched = true
    return { ...s, name: next }
  })
  return touched ? out : scenes.slice()
}

/** Remove a scene by id (returns a new array). */
export const deleteScene = (scenes: readonly Scene[], id: Id): Scene[] =>
  scenes.filter((s) => s.id !== id)

/** Find a scene by (case-insensitive) name — used by the LLM "load by name". */
export const findSceneByName = (
  scenes: readonly Scene[],
  name: string
): Scene | undefined => {
  const q = name.trim().toLowerCase()
  return scenes.find((s) => s.name.toLowerCase() === q)
}

// ----------------------------------------------------------- IDB primitives

/** Load all scenes for a song (newest-first), or [] if none / unavailable. */
export const loadScenes = async (docId: Id): Promise<Scene[]> => {
  try {
    const db = await getBeatloungeDb()
    if (!db) return []
    const list = (await db.get(STORE, keyFor(docId))) as Scene[] | undefined
    return Array.isArray(list) ? sortScenes(list) : []
  } catch (err) {
    console.warn("[beatlounge/scenes] load failed:", err)
    return []
  }
}

/** Persist the whole scene list for a song (caller already mutated the array). */
export const saveScenes = async (docId: Id, scenes: Scene[]): Promise<void> => {
  try {
    const db = await getBeatloungeDb()
    if (!db) return
    await db.put(STORE, scenes, keyFor(docId))
  } catch (err) {
    console.warn("[beatlounge/scenes] save failed:", err)
  }
}

/** Clear all scenes for a song (used by "new song" flows / tests). */
export const clearScenes = async (docId: Id): Promise<void> => {
  try {
    const db = await getBeatloungeDb()
    if (!db) return
    await db.delete(STORE, keyFor(docId))
  } catch (err) {
    console.warn("[beatlounge/scenes] clear failed:", err)
  }
}
