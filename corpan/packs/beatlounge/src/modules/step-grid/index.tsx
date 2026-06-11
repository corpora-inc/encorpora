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
import { makeDeferredUnmount } from "../_shared/deferUnmount"
import type {
  BeatloungeHost,
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { AudioFacade } from "../../contracts/audioFacade"
import { useBeatloungeStore, type BeatloungeStore } from "../../store/store"
import { isInstrumentTrack } from "../../model/document"
import { newDrumTrack } from "../grooves/grooveModel"
import { stepGridActions } from "./actions"
import { DrumGrooveWidget } from "./DrumGrooveWidget"
import { StepGridImmersive } from "./StepGridImmersive"
import "./step-grid.css"
// The Drums page embeds the shared Grooves panel + FX chain; pull their styles
// in so they're present even if those modules' tiles aren't mounted first.
import "../grooves/grooves.css"
import "../fx-rack/styles.css"

export interface StepGridDeps {
  store: BeatloungeStore
  audio: AudioFacade
}

export const STEP_GRID_ID = "step-grid"

/**
 * Reactive root for the Drums page: finds the drum track LIVE (so creating one
 * shows the grid immediately — no remount), and when there is none renders a
 * recovery surface that creates a drum track in one tap. The drum track can NEVER
 * be a dead end: drums are first-class and always recoverable here.
 */
const DrumsRoot = ({
  store,
  audio,
  host,
  surface,
  fallbackId,
}: {
  store: BeatloungeStore
  audio: AudioFacade
  host: BeatloungeHost
  surface: "tile" | "immersive"
  fallbackId?: string
}) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const drumId =
    (fallbackId && doc.tracks.some((t) => t.id === fallbackId) ? fallbackId : undefined) ??
    doc.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")?.id

  if (!drumId) {
    const createDrums = () => store.dispatch({ t: "addTrack", track: newDrumTrack() })
    if (surface === "tile") {
      return (
        <button type="button" className="bl-drums-empty bl-drums-empty--tile" onClick={createDrums}>
          <span className="bl-drums-empty-title">Add drum track</span>
        </button>
      )
    }
    return (
      <div className="bl-drums-empty">
        <p className="bl-drums-empty-title">No drum track</p>
        <button type="button" className="bl-drums-empty-btn" onClick={createDrums}>
          Create drum track
        </button>
      </div>
    )
  }

  return surface === "tile" ? (
    <DrumGrooveWidget host={host} store={store} audio={audio} trackId={drumId} />
  ) : (
    <StepGridImmersive host={host} store={store} audio={audio} trackId={drumId} />
  )
}

export const createStepGridModule = ({ store, audio }: StepGridDeps): BeatloungeModule => ({
  id: STEP_GRID_ID,
  kind: "sequencer",
  title: "Drums",
  glyph: "grid",
  immersive: "full",
  tileAspect: "wide",
  // The Stage tile is a LIVE groove widget (density dial + shuffle), not a
  // tap-to-open summary — the shell renders it un-buttoned + adds the expand.
  tileInteractive: true,
  actions: stepGridActions,
  mount(mount: ModuleMount): ModuleInstance {
    const root: Root = createRoot(mount.container)
    // DrumsRoot reads the doc reactively, so it handles create/recovery + live
    // updates itself — no manual re-render needed on doc change.
    root.render(
      <DrumsRoot
        store={store}
        audio={audio}
        host={mount.host}
        surface={mount.surface}
        fallbackId={mount.trackId}
      />
    )

    return {
      unmount: makeDeferredUnmount(root),
    }
  },
})
