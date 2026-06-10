/**
 * beatlounge — the instruments module (kind "instrument"): the General-MIDI
 * instrument browser. The tile summarizes a track's current voice; the immersive
 * view browses GM families → programs and re-voices the track to a real
 * soundfont instrument (one `setInstrument` per pick) with an instant audition.
 *
 * Mirrors the step-grid / fx-rack module pattern: a `createInstrumentsModule(deps)`
 * factory binds store + audio + host and renders its own React root into the
 * host-provided container. The integrator registers it in allModules.ts; this
 * file never edits the shell or the registration site.
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
  const melodic = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"
  )
  return (melodic ?? doc.tracks.find((t) => isInstrumentTrack(t)))?.id
}

export const createInstrumentsModule = ({
  store,
  audio,
  host,
}: InstrumentsDeps): BeatloungeModule => {
  void audio // auditions go through host.previewTrack, not the facade directly
  void host
  return {
    id: INSTRUMENTS_ID,
    kind: "instrument",
    title: "Instruments",
    glyph: "drawer",
    immersive: "full",
    tileAspect: "wide",
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
        unmount() {
          try { root.unmount() } catch { /* root container already detached */ }
        },
        refreshTile: render,
      }
    },
  }
}
