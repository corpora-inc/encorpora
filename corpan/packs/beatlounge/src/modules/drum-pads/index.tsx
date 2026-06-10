/**
 * beatlounge — the drum-pads module (kind "instrument"). Mirrors the step-grid
 * module: a factory binds the store + audio (+ host) and returns a
 * BeatloungeModule whose `mount()` renders the tile or the immersive view into
 * the host container via its own React root.
 *
 * It binds to the drum track — the first drumSampler instrument track — and
 * presents it as a velocity pad bank (an alternate surface over the same lanes
 * the step grid sequences). The action registry (randomPattern) is exposed so
 * the LLM command bus can index it across all modules with no shell change.
 */

import { createRoot, type Root } from "react-dom/client"
import type {
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { ModuleDeps } from "../allModules"
import { isInstrumentTrack } from "../../model/document"
import type { BeatloungeStore } from "../../store/store"
import { drumPadsActions } from "./actions"
import { DrumPadsTile } from "./DrumPadsTile"
import { DrumPadsImmersive } from "./DrumPadsImmersive"
import "./styles.css"

export const DRUM_PADS_ID = "drum-pads"

/** Resolve the drum track id: the first drumSampler instrument track. */
const resolveDrumTrackId = (
  store: BeatloungeStore,
  fallback?: string
): string | undefined => {
  if (fallback) return fallback
  const doc = store.vanilla.getState().doc
  const drum = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
  )
  return drum?.id
}

export const createDrumPadsModule = ({ store, audio }: ModuleDeps): BeatloungeModule => ({
  id: DRUM_PADS_ID,
  kind: "instrument",
  title: "Pads",
  glyph: "grid",
  immersive: "full",
  tileAspect: "square",
  actions: drumPadsActions,
  mount(mount: ModuleMount): ModuleInstance {
    const root: Root = createRoot(mount.container)
    const trackId = resolveDrumTrackId(store, mount.trackId)

    const render = () => {
      if (!trackId) {
        root.render(<div className="bl-grid-empty">No drum track.</div>)
        return
      }
      if (mount.surface === "tile") {
        root.render(
          <DrumPadsTile store={store} audio={audio} trackId={trackId} title="Pads" />
        )
      } else {
        root.render(
          <DrumPadsImmersive
            host={mount.host}
            store={store}
            audio={audio}
            trackId={trackId}
          />
        )
      }
    }

    render()

    return {
      unmount() {
        try { root.unmount() } catch { /* root container already detached */ }
      },
      refreshTile: render,
    }
  },
})
