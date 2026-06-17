/**
 * beatlounge — the Scenes CONTROLLER: a small reactive state holder over the
 * command bus + the persisted scenes slice. It owns everything the Scenes UI
 * needs that is NOT in the doc:
 *   - the saved scene list for the active song (hydrated from IDB),
 *   - which scene (if any) is currently LOADED, and
 *   - whether the live doc has DRIFTED from that loaded scene (unsaved dot).
 *
 * "Loaded scene id" is deliberately module state, not a doc field: it is a UI
 * affordance ("you're looking at scene B"), not part of the song's sound, so it
 * must not travel with the doc / undo / export. When the user loads scene B, we
 * remember B and stamp the snapshot we loaded; any later command that changes
 * the musical state flips `dirty` true. Saving / loading clears it.
 *
 * Pure list math lives in ../../store/scenesStore; this just sequences IDB +
 * notifies React. Vanilla zustand store so the tile + immersive both subscribe.
 */

import { createStore, type StoreApi } from "zustand/vanilla"
import { useStore } from "zustand"
import type { CommandBus } from "../../model/commandBus"
import type { Id } from "../../model/document"
import { captureSnapshot, snapshotsEqual, type SceneSnapshot } from "../../model/snapshot"
import { defaultSceneName } from "../../util/sceneName"
import {
  addScene,
  deleteScene,
  loadScenes,
  makeScene,
  renameScene,
  saveScenes,
  sortScenes,
  type Scene,
} from "../../store/scenesStore"
import { selectGroove } from "../../store/selectedGroove"
import { disarmAllRecord } from "../../store/recordArm"
import { buildEmptySnapshot, buildRandomSnapshot } from "./startFresh"
import { compileDemo, getDemo } from "./demos"

export interface ScenesState {
  /** Newest-first saved scenes for the active song. */
  scenes: Scene[]
  /** True once IDB hydration has settled. */
  hydrated: boolean
  /** The scene the live doc was last loaded from / saved as (else null). */
  activeSceneId: Id | null
  /** True ⇒ the live doc has drifted from `activeSceneId`'s snapshot. */
  dirty: boolean
}

export interface ScenesController {
  readonly vanilla: StoreApi<ScenesState>
  /** Save the current doc as a NEW scene (default name unless `name` given). */
  save(name?: string): Promise<Scene>
  /** Load a scene into the live doc (atomic + undoable via the bus). */
  load(sceneId: Id): void
  /** Start fresh: wipe to the EMPTY default (Clear). One undoable step. */
  clear(): void
  /** Start fresh: an empty grid with randomized instruments / kit / harmony /
   *  meter (Randomize). One undoable step; also re-rolls the selected groove. */
  randomize(): void
  /** Start fresh: load a shipped demo song by id (no-op if unknown). Undoable. */
  loadDemo(demoId: string): boolean
  /** Rename a scene (ignored if blank). */
  rename(sceneId: Id, name: string): Promise<void>
  /** Delete a scene. */
  remove(sceneId: Id): Promise<void>
  /** Async: hydrate the scene list for the current song from IDB. */
  hydrate(): Promise<void>
  dispose(): void
}

/** Entropy seed for default names — distinct per call, deterministic-injectable
 *  only in tests (production wants variety). */
const seedNow = (): number =>
  (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0

export interface ScenesControllerOpts {
  /** Inject `now` (epoch ms) — tests pass a fixed clock. */
  now?: () => number
  /** Inject the name seed — tests pass a fixed seed for deterministic names. */
  seed?: () => number
  /** Inject the 0..1 RNG used by Randomize — tests pass a seeded stream. */
  rng?: () => number
}

export const createScenesController = (
  bus: CommandBus,
  opts: ScenesControllerOpts = {}
): ScenesController => {
  const now = opts.now ?? (() => Date.now())
  const seed = opts.seed ?? seedNow
  const rng = opts.rng ?? Math.random

  const vanilla = createStore<ScenesState>(() => ({
    scenes: [],
    hydrated: false,
    activeSceneId: null,
    dirty: false,
  }))

  // The snapshot the live doc was loaded from / saved as — used to detect drift.
  let baseSnapshot: SceneSnapshot | null = null
  // The doc id whose scenes we currently hold (to refetch on song change).
  let docId: Id = bus.snapshot().id

  const recomputeDirty = () => {
    const { activeSceneId } = vanilla.getState()
    if (!activeSceneId || !baseSnapshot) {
      if (vanilla.getState().dirty) vanilla.setState({ dirty: false })
      return
    }
    const live = captureSnapshot(bus.snapshot())
    const drifted = !snapshotsEqual(live, baseSnapshot)
    if (drifted !== vanilla.getState().dirty) vanilla.setState({ dirty: drifted })
  }

  // Any bus change can change drift. A "load" (new song) resets everything.
  const unsub = bus.subscribe((doc, meta) => {
    if (doc.id !== docId) {
      // The active song changed under us — drop scene context + re-hydrate.
      docId = doc.id
      baseSnapshot = null
      vanilla.setState({ scenes: [], activeSceneId: null, dirty: false, hydrated: false })
      void hydrate()
      return
    }
    if (meta.kind === "load") {
      // Whole-doc replacement (import) — the loaded-scene context no longer holds.
      baseSnapshot = null
      vanilla.setState({ activeSceneId: null, dirty: false })
      return
    }
    recomputeDirty()
  })

  const persist = async (scenes: Scene[]) => {
    vanilla.setState({ scenes: sortScenes(scenes) })
    await saveScenes(docId, scenes)
  }

  async function hydrate(): Promise<void> {
    const list = await loadScenes(docId)
    vanilla.setState({ scenes: list, hydrated: true })
  }

  return {
    vanilla,

    async save(name?: string): Promise<Scene> {
      const snapshot = captureSnapshot(bus.snapshot())
      const finalName = (name && name.trim()) || defaultSceneName(now(), seed())
      const scene = makeScene(finalName, snapshot, now())
      const next = addScene(vanilla.getState().scenes, scene)
      baseSnapshot = scene.snapshot
      vanilla.setState({ activeSceneId: scene.id, dirty: false })
      await persist(next)
      return scene
    },

    load(sceneId: Id): void {
      const scene = vanilla.getState().scenes.find((s) => s.id === sceneId)
      if (!scene) return
      // One atomic, undoable command — the bus pushes the prior doc onto undo.
      bus.dispatch({ t: "loadScene", snapshot: scene.snapshot })
      baseSnapshot = scene.snapshot
      vanilla.setState({ activeSceneId: scene.id, dirty: false })
    },

    // ----- Start fresh: clear / randomize / load a demo -----
    // All three replace the musical state via ONE undoable `loadScene` command
    // (a mis-tap is one undo away) and drop any "loaded scene" context — these
    // are fresh starts, not saved scenes. Persisted via the store's debounce.
    clear(): void {
      bus.dispatch({ t: "loadScene", snapshot: buildEmptySnapshot() })
      disarmAllRecord() // the old tracks are gone — never come up armed
      baseSnapshot = null
      vanilla.setState({ activeSceneId: null, dirty: false })
    },

    randomize(): void {
      const { snapshot, grooveId } = buildRandomSnapshot(rng)
      bus.dispatch({ t: "loadScene", snapshot })
      selectGroove(grooveId) // the selected-groove slice lives outside the doc
      disarmAllRecord()
      baseSnapshot = null
      vanilla.setState({ activeSceneId: null, dirty: false })
    },

    loadDemo(demoId: string): boolean {
      const demo = getDemo(demoId)
      if (!demo) return false
      bus.dispatch({ t: "loadScene", snapshot: compileDemo(demo) })
      if (demo.grooveId) selectGroove(demo.grooveId)
      disarmAllRecord()
      baseSnapshot = null
      vanilla.setState({ activeSceneId: null, dirty: false })
      return true
    },

    async rename(sceneId: Id, name: string): Promise<void> {
      const next = renameScene(vanilla.getState().scenes, sceneId, name)
      await persist(next)
    },

    async remove(sceneId: Id): Promise<void> {
      const next = deleteScene(vanilla.getState().scenes, sceneId)
      if (vanilla.getState().activeSceneId === sceneId) {
        baseSnapshot = null
        vanilla.setState({ activeSceneId: null, dirty: false })
      }
      await persist(next)
    },

    hydrate,

    dispose() {
      unsub()
    },
  }
}

/** React hook: subscribe to a slice of the scenes controller. */
export const useScenes = <T>(
  ctrl: ScenesController,
  selector: (s: ScenesState) => T
): T => useStore(ctrl.vanilla, selector)
