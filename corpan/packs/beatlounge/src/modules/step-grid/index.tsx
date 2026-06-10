/**
 * beatlounge — the step-grid module (kind "sequencer"), the first real
 * BeatloungeModule. A factory binds the store + audio (not part of the frozen
 * ModuleMount) and returns a module whose `mount()` renders the tile or the
 * immersive view into the host-provided container via its own React root.
 *
 * The action registry (clear / fillEveryOther) is exposed so the future LLM
 * command bus can index it across all modules — no shell change needed.
 */

import { createRoot, type Root } from "react-dom/client"
import type {
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeStore } from "../../store/store"
import { isInstrumentTrack } from "../../model/document"
import { stepGridActions } from "./actions"
import { StepGridTile } from "./StepGridTile"
import { StepGridImmersive } from "./StepGridImmersive"

export interface StepGridDeps {
  store: BeatloungeStore
  audio: AudioFacade
}

export const STEP_GRID_ID = "step-grid"

/** Resolve the drum track id for the current doc (the module binds to it). */
const resolveDrumTrackId = (store: BeatloungeStore, fallback?: string): string | undefined => {
  if (fallback) return fallback
  const doc = store.vanilla.getState().doc
  const drum = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
  )
  return drum?.id
}

export const createStepGridModule = ({ store, audio }: StepGridDeps): BeatloungeModule => ({
  id: STEP_GRID_ID,
  kind: "sequencer",
  title: "Drums",
  glyph: "grid",
  immersive: "full",
  tileAspect: "wide",
  actions: stepGridActions,
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
          <StepGridTile store={store} audio={audio} trackId={trackId} title="Drums" />
        )
      } else {
        root.render(
          <StepGridImmersive
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
        // Defer to avoid React "unmount during render" warnings on fast swaps.
        queueMicrotask(() => root.unmount())
      },
      refreshTile: render,
    }
  },
})
