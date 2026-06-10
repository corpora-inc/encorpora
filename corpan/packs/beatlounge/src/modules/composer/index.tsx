/**
 * beatlounge — the Composer module (kind "instrument"). The HARMONY/JAM surface.
 *
 * Mirrors the step-grid / piano-roll module factory: a factory binds the store +
 * audio (+ host) and returns a BeatloungeModule whose `mount()` renders the tile
 * or the immersive composer into the host container via its own React root.
 *
 * It binds to the melodic "Synth" track — the first non-drumSampler instrument
 * track — and writes composed jams onto it. The action registry (jam) is exposed
 * so the LLM command bus indexes the harmony surface with no shell change.
 *
 * The integrator wires `createComposerModule(deps)` into allModules.ts.
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
import { composerActions } from "./actions"
import { ComposerTile } from "./ComposerTile"
import { ComposerImmersive } from "./ComposerImmersive"
import "./styles.css"

export const COMPOSER_ID = "composer"

/** Resolve the melodic track id: the first non-drum instrument track (Synth). */
const resolveSynthTrackId = (
  store: BeatloungeStore,
  fallback?: string
): string | undefined => {
  if (fallback) return fallback
  const doc = store.vanilla.getState().doc
  const synth = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"
  )
  return synth?.id
}

export const createComposerModule = ({ store, audio }: ModuleDeps): BeatloungeModule => ({
  id: COMPOSER_ID,
  kind: "instrument",
  title: "Composer",
  glyph: "wave",
  immersive: "full",
  tileAspect: "wide",
  actions: composerActions,
  mount(mount: ModuleMount): ModuleInstance {
    const root: Root = createRoot(mount.container)
    const trackId = resolveSynthTrackId(store, mount.trackId)

    const render = () => {
      if (!trackId) {
        root.render(<div className="bl-grid-empty">No synth track.</div>)
        return
      }
      if (mount.surface === "tile") {
        root.render(<ComposerTile store={store} trackId={trackId} title="Composer" />)
      } else {
        root.render(
          <ComposerImmersive
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
