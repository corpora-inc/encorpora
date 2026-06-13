/**
 * beatlounge — the mixer module (kind "mixer"). A console view of every track:
 * fader + pan + Mute/Solo + meter, plus a master fader. The tile is a compact
 * read-only strip summary; the immersive view is the full console. Every move
 * dispatches setTrackProp / setMasterVolume (one undo step each).
 *
 * Mirrors step-grid: a `createMixerModule(deps)` factory binds store + audio +
 * host and renders its own React root into the host container.
 */

import { createRoot, type Root } from "react-dom/client"
import { makeDeferredUnmount } from "../_shared/deferUnmount"
import type {
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeStore } from "../../store/store"
import { mixerActions } from "./actions"
import { MixerTile } from "./MixerTile"
import { MixerConsole } from "./MixerConsole"
import { ct } from "../../i18n/strings"
import "./styles.css"
// The mixer is now the HOME for per-track effects (the shared rack) + Players —
// pull in their stylesheets directly so the console renders correctly even if
// the integrator deregisters the standalone Effects / Players tiles.
import "../fx-rack/styles.css"
import "../tweakers/styles.css"

export interface MixerDeps {
  store: BeatloungeStore
  audio: AudioFacade
}

export const MIXER_ID = "mixer"

export const createMixerModule = ({ store, audio }: MixerDeps): BeatloungeModule => ({
  id: MIXER_ID,
  kind: "mixer",
  title: ct("mixer.title"),
  glyph: "sliders",
  immersive: "full",
  tileAspect: "full",
  actions: mixerActions,
  mount(mount: ModuleMount): ModuleInstance {
    const root: Root = createRoot(mount.container)

    const render = () => {
      if (mount.surface === "tile") {
        root.render(<MixerTile store={store} audio={audio} />)
      } else {
        root.render(<MixerConsole store={store} audio={audio} host={mount.host} />)
      }
    }

    render()

    return {
      unmount: makeDeferredUnmount(root),
      refreshTile: render,
    }
  },
})
