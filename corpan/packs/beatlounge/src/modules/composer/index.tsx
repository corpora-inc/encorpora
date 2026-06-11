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
import { makeDeferredUnmount } from "../_shared/deferUnmount"
import type {
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { ModuleDeps } from "../allModules"
import { isInstrumentTrack } from "../../model/document"
import type { BeatloungeStore } from "../../store/store"
import { composerActions } from "./actions"
import { HarmonyWidget } from "./HarmonyWidget"
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
  title: "Harmony",
  glyph: "wave",
  immersive: "full",
  tileAspect: "square",
  // The Stage tile is a live summary whose control opens a HOME POPOVER (the
  // full HarmonyPanel), not the immersive page — so it owns its own affordance.
  tileInteractive: true,
  tileOwnsExpand: true,
  actions: composerActions,
  mount(mount: ModuleMount): ModuleInstance {
    const root: Root = createRoot(mount.container)

    const render = () => {
      if (mount.surface === "tile") {
        // The popover binds the snap to the persisted selected synth itself.
        root.render(<HarmonyWidget host={mount.host} store={store} />)
        return
      }
      const trackId = resolveSynthTrackId(store, mount.trackId)
      if (!trackId) {
        root.render(<div className="bl-grid-empty">No synth track.</div>)
        return
      }
      root.render(
        <ComposerImmersive
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
