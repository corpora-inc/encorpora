/**
 * beatlounge — the Scenes module (kind "arrangement"): save, name, and switch
 * between complete states of a rhythmic cycle. A Scene is a named snapshot of
 * the whole musical state; loading one replaces the live song with that
 * snapshot in one atomic, undoable step (a mis-tap is one undo away). Scenes are
 * curated checkpoints (A → B → C, then jump freely), NOT undo/redo.
 *
 * Mirrors the other modules: `createScenesModule(deps)` returns a
 * BeatloungeModule with a tile + immersive view and an LLM action registry. The
 * integrator registers it in allModules.ts (this file never touches that).
 *
 * ONE ScenesController is created per factory call and SHARED across the tile
 * and immersive mounts, so the saved list + active/dirty indicators stay
 * consistent everywhere. It hydrates from IDB on first mount. It dispatches the
 * `loadScene` command through `deps.host.bus` — the same bus the store mirrors.
 */

import { createRoot, type Root } from "react-dom/client"
import { makeDeferredUnmount } from "../_shared/deferUnmount"
import type {
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { BeatloungeHost } from "../../contracts/module"
import { createScenesController, type ScenesController } from "./scenesController"
import { createScenesActions } from "./actions"
import { ScenesTile } from "./ScenesTile"
import { ScenesImmersive } from "./ScenesImmersive"
import "./scenes.css"

export interface ScenesDeps {
  store: BeatloungeStore
  host: BeatloungeHost
}

export const SCENES_ID = "scenes"

export const createScenesModule = ({ host }: ScenesDeps): BeatloungeModule => {
  // One controller, shared across tile + immersive mounts of this module.
  const ctrl: ScenesController = createScenesController(host.bus)
  let hydrated = false
  const ensureHydrated = () => {
    if (hydrated) return
    hydrated = true
    void ctrl.hydrate()
  }

  return {
    id: SCENES_ID,
    kind: "arrangement",
    title: "Scenes",
    glyph: "drawer",
    immersive: "full",
    tileAspect: "square",
    actions: createScenesActions(ctrl),
    mount(mount: ModuleMount): ModuleInstance {
      ensureHydrated()
      const root: Root = createRoot(mount.container)

      const render = () => {
        if (mount.surface === "tile") {
          root.render(<ScenesTile ctrl={ctrl} />)
        } else {
          root.render(<ScenesImmersive ctrl={ctrl} host={mount.host} />)
        }
      }

      render()

      return {
        unmount: makeDeferredUnmount(root),
        refreshTile: render,
      }
    },
  }
}
