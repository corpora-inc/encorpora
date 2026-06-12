/**
 * beatlounge — the ribbon module (kind "instrument"). Mirrors the piano-roll /
 * drum-pads factory: a `createRibbonModule(deps)` binds the store + audio (+
 * host) and returns a BeatloungeModule whose `mount()` renders the tile or the
 * immersive ribbon into the host container via its own React root.
 *
 * It performs into the melodic "Synth" track (the first non-drum instrument
 * track) — recording captures live play there — but its LIVE voice is its own
 * Tone synth on the shared AudioContext (see ribbonVoice), so the instrument is
 * independent of the track's instrument and the audio graph.
 *
 * Export `createRibbonModule`; the integrator registers it in allModules.ts.
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
import { INSTRUMENTS_ID } from "../instruments"
import { ribbonActions } from "./actions"
import { RibbonWidget } from "./RibbonWidget"
import { RibbonImmersive } from "./RibbonImmersive"
import "./styles.css"

export const RIBBON_ID = "ribbon"

/** Resolve the melodic track id: the first non-drum instrument track (Synth). */
const resolveMelodicTrackId = (
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

export const createRibbonModule = ({ store, audio }: ModuleDeps): BeatloungeModule => ({
  id: RIBBON_ID,
  kind: "instrument",
  title: "Ribbon",
  glyph: "wave",
  immersive: "full",
  // A comfortable play strip on the Stage — a live widget, not a summary.
  tileAspect: "square",
  tileInteractive: true,
  // The voice is managed on the Instruments page; the expand opens it there.
  tileExpandTo: INSTRUMENTS_ID,
  actions: ribbonActions,
  mount(mount: ModuleMount): ModuleInstance {
    const root: Root = createRoot(mount.container)

    const render = () => {
      if (mount.surface === "tile") {
        // Bound to the PERSISTED selected synth (same voice the Instruments page
        // edits) — reactive, so a new selection re-points it live.
        root.render(<RibbonWidget host={mount.host} store={store} audio={audio} />)
        return
      }
      const trackId = resolveMelodicTrackId(store, mount.trackId)
      if (!trackId) {
        root.render(<div className="bl-grid-empty">No melodic track.</div>)
        return
      }
      root.render(
        <RibbonImmersive
          host={mount.host}
          store={store}
          audio={audio}
          trackId={trackId}
        />
      )
    }

    render()

    return {
      unmount: makeDeferredUnmount(root),
      refreshTile: render,
    }
  },
})
