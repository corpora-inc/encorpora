/**
 * beatlounge — the fx-rack module (kind "effect"). A per-track insert chain +
 * aux-send editor. The tile is a compact chain summary; the immersive view is
 * the full rack: add/remove/reorder inserts, per-effect param knobs + enable
 * toggles, and send levels to fx/group buses. Every gesture dispatches one of
 * the effect/send commands through the store (one undo step each).
 *
 * Mirrors step-grid: a `createFxRackModule(deps)` factory binds the store +
 * audio + host and renders its own React root into the host container.
 */

import { createRoot, type Root } from "react-dom/client"
import type {
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { fxRackActions } from "./actions"
import { FxRackTile } from "./FxRackTile"
import { FxRackImmersive } from "./FxRackImmersive"
import "./styles.css"

export interface FxRackDeps {
  store: BeatloungeStore
  audio: AudioFacade
  host: BeatloungeHost
}

export const FX_RACK_ID = "fx-rack"

/** Resolve the track this rack binds to: the mount's track, else the first. */
const resolveTrackId = (store: BeatloungeStore, fallback?: string): string | undefined => {
  if (fallback) return fallback
  return store.vanilla.getState().doc.tracks[0]?.id
}

export const createFxRackModule = ({ store, audio }: FxRackDeps): BeatloungeModule => {
  void audio
  return {
    id: FX_RACK_ID,
    kind: "effect",
    title: "Effects",
    glyph: "sliders",
    immersive: "full",
    tileAspect: "wide",
    actions: fxRackActions,
    mount(mount: ModuleMount): ModuleInstance {
      const root: Root = createRoot(mount.container)
      const trackId = resolveTrackId(store, mount.trackId)

      const render = () => {
        if (!trackId) {
          root.render(<div className="bl-grid-empty">No track.</div>)
          return
        }
        if (mount.surface === "tile") {
          root.render(<FxRackTile store={store} trackId={trackId} />)
        } else {
          root.render(
            <FxRackImmersive host={mount.host} store={store} trackId={trackId} />
          )
        }
      }

      render()

      return {
        unmount() {
          queueMicrotask(() => root.unmount())
        },
        refreshTile: render,
      }
    },
  }
}
