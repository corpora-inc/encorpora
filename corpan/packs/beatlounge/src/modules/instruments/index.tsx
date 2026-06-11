/**
 * beatlounge — the instruments module (kind "instrument"): a PLAYABLE
 * software-instrument surface. The tile summarizes a track's current voice; the
 * immersive view is a multitouch, continuous-pitch play surface (fretless /
 * chromatic / scale modes) that performs the bound track's voice live, with a
 * preset picker grouped by family (Keys, Bass, Leads, Pads, …) that re-voices
 * the bound track (one `setInstrument` per pick) plus an Add affordance to spawn
 * more melodic synth tracks. You hear a voice by PLAYING it — there is no
 * separate audition.
 *
 * Mirrors the step-grid / fx-rack module pattern: a `createInstrumentsModule(deps)`
 * factory binds store + audio + host and renders its own React root into the
 * host-provided container. The integrator registers it in allModules.ts; this
 * file never edits the shell or the registration site.
 */

import { createRoot, type Root } from "react-dom/client"
import { makeDeferredUnmount } from "../_shared/deferUnmount"
import type {
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { isInstrumentTrack } from "../../model/document"
import { instrumentsActions } from "./actions"
import { InstrumentsTile } from "./InstrumentsTile"
import { InstrumentsBrowser } from "./InstrumentsBrowser"
import "./styles.css"

export interface InstrumentsDeps {
  store: BeatloungeStore
  audio: AudioFacade
  host: BeatloungeHost
}

export const INSTRUMENTS_ID = "instruments"

/** Bind to the mount's track, else the first melodic (non-drum) instrument
 *  track — the most likely thing a user wants to re-voice. */
const resolveTrackId = (store: BeatloungeStore, fallback?: string): string | undefined => {
  if (fallback) return fallback
  const doc = store.vanilla.getState().doc
  // ONLY melodic (non-drum) tracks. A drum track is an InstrumentTrack too, but
  // it must NEVER be a target here — voicing it with "Grand Piano" would destroy
  // the kit. No melodic track ⇒ undefined (the browser offers to add one).
  return doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"
  )?.id
}

export const createInstrumentsModule = ({
  store,
  audio,
  host,
}: InstrumentsDeps): BeatloungeModule => {
  void audio // live play goes through host.playLiveVoice, not the facade directly
  void host
  return {
    id: INSTRUMENTS_ID,
    kind: "instrument",
    title: "Instruments",
    glyph: "drawer",
    immersive: "full",
    tileAspect: "square",
    actions: instrumentsActions,
    mount(mount: ModuleMount): ModuleInstance {
      const root: Root = createRoot(mount.container)
      const trackId = resolveTrackId(store, mount.trackId)

      const render = () => {
        if (!trackId) {
          root.render(<div className="bl-grid-empty">No instrument track.</div>)
          return
        }
        if (mount.surface === "tile") {
          root.render(<InstrumentsTile store={store} trackId={trackId} />)
        } else {
          root.render(
            <InstrumentsBrowser host={mount.host} store={store} trackId={trackId} />
          )
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
