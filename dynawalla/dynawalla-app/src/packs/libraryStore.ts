// The library, as app state.
//
// Everything that decides anything is in `library.ts` and is tested in Node.
// This is the part that cannot be: the Tauri call, the build version, and the
// store a screen subscribes to.
//
// It runs once at launch and can be re-run. In a plain browser — `npm run dev`
// with no Tauri — there is no pack root and the library is empty, which is the
// honest answer rather than a mocked one.

import { create } from "zustand"

import { BUILD_VERSION, isNative } from "../app/platform.ts"
import { cardFacts, hostProfile, readLibrary, type LibraryEntry, type LibraryProblem } from "./library.ts"
import { tauriNative } from "./native.ts"
import { usePacks } from "./registry.ts"

export interface LibraryState {
  readonly ready: boolean
  readonly entries: readonly LibraryEntry[]
  /** Installed but not runnable here, with the reason a parent can act on. */
  readonly problems: readonly LibraryProblem[]
  refresh: () => Promise<void>
}

export const useLibrary = create<LibraryState>()((set) => ({
  ready: false,
  entries: [],
  problems: [],
  refresh: async () => {
    if (!isNative) {
      // A browser has no pack root. Saying so once, loudly, is what stops the
      // next person wondering why the front door is empty in `npm run dev`.
      console.warn("[packs] not running natively — no packs are installed in a browser tab")
      set({ ready: true, entries: [], problems: [] })
      return
    }
    try {
      const { entries, problems } = await readLibrary({
        native: tauriNative,
        host: hostProfile(BUILD_VERSION),
      })
      set({ ready: true, entries, problems })
      // Mirror into the persisted record, which is what the parent-facing
      // counts read. Written from the manifest rather than from a second
      // source, so the two cannot disagree about a version.
      const record = usePacks.getState().record
      for (const entry of entries) {
        record({
          id: entry.manifest.id,
          name: entry.name,
          version: entry.manifest.version,
          bytes: entry.bytes,
          sha256: entry.manifest.download.sha256,
          installedAt: Date.now(),
          // What the catalogue draws a card from. Written here, from the same
          // manifest the version came from, so the record and the card cannot
          // disagree about what a pack is. `cardFacts` is shared with
          // `useHost`, which writes the same fields back over this record —
          // two hand-written copies of one list is how a field goes missing on
          // one side of a launch.
          ...cardFacts(entry),
        })
      }
      const live = new Set(entries.map((entry) => entry.manifest.id))
      for (const stored of usePacks.getState().installed) {
        if (!live.has(stored.id)) usePacks.getState().forget(stored.id)
      }
      for (const problem of problems) {
        console.error(`[packs] ${problem.id}: ${problem.refusal.message}`, problem.refusal.problems ?? "")
      }
    } catch (error) {
      console.error("[packs] could not read the pack root", error)
      set({ ready: true })
    }
  },
}))

export function entryOf(id: string): LibraryEntry | undefined {
  return useLibrary.getState().entries.find((entry) => entry.manifest.id === id)
}
