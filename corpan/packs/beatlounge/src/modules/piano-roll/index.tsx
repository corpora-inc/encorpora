/**
 * beatlounge — the piano-roll module (kind "sequencer"). Mirrors the step-grid
 * module exactly: a factory binds the store + audio (+ host) and returns a
 * BeatloungeModule whose `mount()` renders the tile or the immersive view into
 * the host container via its own React root.
 *
 * It binds to the melodic "Synth" track — the first non-drumSampler instrument
 * track. The action registry (clear / arpeggiate / transpose) is exposed so the
 * LLM command bus can index it across all modules with no shell change.
 */

import { createRoot, type Root } from "react-dom/client"
import { makeDeferredUnmount } from "../_shared/deferUnmount"
import type {
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { ModuleDeps } from "../allModules"
import { isInstrumentTrack } from "../../model/document"
import type { BeatloungeStore } from "../../store/store"
import { pianoRollActions } from "./actions"
import { PianoRollTile } from "./PianoRollTile"
import { PianoRollImmersive } from "./PianoRollImmersive"
import "./styles.css"

export const PIANO_ROLL_ID = "piano-roll"

/** Resolve the melodic track id: the first non-drum instrument track (Synth).
 *  Exported for the targeting test — the roll must NEVER bind to a drum track. */
export const resolveMelodicTrackId = (
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

export const createPianoRollModule = ({ store, audio }: ModuleDeps): BeatloungeModule => ({
  id: PIANO_ROLL_ID,
  kind: "sequencer",
  title: "Synth",
  glyph: "wave",
  immersive: "full",
  tileAspect: "wide",
  actions: pianoRollActions,
  mount(mount: ModuleMount): ModuleInstance {
    const root: Root = createRoot(mount.container)
    const trackId = resolveMelodicTrackId(store, mount.trackId)

    const render = () => {
      if (!trackId) {
        root.render(<div className="bl-grid-empty">No melodic track.</div>)
        return
      }
      if (mount.surface === "tile") {
        root.render(
          <PianoRollTile store={store} audio={audio} trackId={trackId} title="Synth" />
        )
      } else {
        root.render(
          <PianoRollImmersive
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
      unmount: makeDeferredUnmount(root),
      refreshTile: render,
    }
  },
})
