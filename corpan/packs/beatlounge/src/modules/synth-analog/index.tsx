/**
 * beatlounge — the synth-analog module (kind "instrument"). A premium
 * sound-design surface bound to a melodic instrument track: the tile is a calm
 * patch summary, the immersive view is the full analog synth — oscillators,
 * the Cutoff × Resonance XYPad, filter & amp envelopes, LFO/glide, drive, a
 * preset picker, and a playable keyboard strip to audition.
 *
 * Mirrors the piano-roll/fx-rack factory pattern: `createAnalogSynthModule(deps)`
 * binds the store + host and renders its own React root into the host container.
 * If the bound track isn't an analogSynth yet, the surface offers to make it one
 * (one `setInstrument` command). The integrator wires this into allModules.
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
import { synthAnalogActions } from "./actions"
import { SynthAnalogTile } from "./SynthAnalogTile"
import { SynthAnalogImmersive } from "./SynthAnalogImmersive"
import "./styles.css"

export const SYNTH_ANALOG_ID = "synth-analog"

/**
 * Resolve the track this surface binds to: prefer an existing analogSynth, else
 * the first non-drum instrument track (so "make analog" has a sensible target),
 * else the first instrument track.
 */
const resolveAnalogTrackId = (
  store: BeatloungeStore,
  fallback?: string
): string | undefined => {
  if (fallback) return fallback
  const doc = store.vanilla.getState().doc
  const analog = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind === "analogSynth"
  )
  if (analog) return analog.id
  const melodic = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"
  )
  if (melodic) return melodic.id
  return doc.tracks.find((t) => isInstrumentTrack(t))?.id
}

export const createAnalogSynthModule = ({ store }: ModuleDeps): BeatloungeModule => ({
  id: SYNTH_ANALOG_ID,
  kind: "instrument",
  title: "Analog",
  glyph: "wave",
  immersive: "full",
  tileAspect: "square",
  actions: synthAnalogActions,
  mount(mount: ModuleMount): ModuleInstance {
    const root: Root = createRoot(mount.container)
    const trackId = resolveAnalogTrackId(store, mount.trackId)

    const render = () => {
      if (!trackId) {
        root.render(<div className="bl-grid-empty">No instrument track.</div>)
        return
      }
      if (mount.surface === "tile") {
        root.render(<SynthAnalogTile store={store} trackId={trackId} />)
      } else {
        root.render(
          <SynthAnalogImmersive host={mount.host} store={store} trackId={trackId} />
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
