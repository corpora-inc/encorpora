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
import type {
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { ModuleDeps } from "../allModules"
import { isInstrumentTrack } from "../../model/document"
import type { BeatloungeStore } from "../../store/store"
import { ribbonActions } from "./actions"
import { RibbonTile } from "./RibbonTile"
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
  tileAspect: "square",
  actions: ribbonActions,
  mount(mount: ModuleMount): ModuleInstance {
    const root: Root = createRoot(mount.container)
    const trackId = resolveMelodicTrackId(store, mount.trackId)

    const render = () => {
      const color = trackId
        ? store.vanilla.getState().doc.tracks.find((t) => t.id === trackId)?.color
        : undefined
      if (mount.surface === "tile") {
        root.render(<RibbonTile store={store} color={color} />)
        return
      }
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
      unmount() {
        try { root.unmount() } catch { /* root container already detached */ }
      },
      refreshTile: render,
    }
  },
})
