/**
 * beatlounge — the tweakers module (kind "utility"): the autonomous knob-tweaker
 * panel. The tile shows how many modulators are live (a calm "N live" + a
 * sparkline); the immersive view lists each active modulator with controls and a
 * prominent row of agent buttons (breathe/drift/chaos/evolve/pulse) + Clear all.
 *
 * Mirrors step-grid / fx-rack: a `createTweakersModule(deps)` factory binds the
 * store + host and renders its own React root into the host-provided container.
 * The integrator registers it in allModules.ts (this file never edits that).
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
import { tweakersActions } from "./actions"
import { TweakersTile } from "./TweakersTile"
import { TweakersImmersive } from "./TweakersImmersive"
import "./styles.css"

export interface TweakersDeps {
  store: BeatloungeStore
  audio: AudioFacade
  host: BeatloungeHost
}

export const TWEAKERS_ID = "tweakers"

export const createTweakersModule = ({ store, audio }: TweakersDeps): BeatloungeModule => {
  void audio
  return {
    id: TWEAKERS_ID,
    kind: "utility",
    title: "Tweakers",
    glyph: "wave",
    immersive: "full",
    tileAspect: "square",
    actions: tweakersActions,
    mount(mount: ModuleMount): ModuleInstance {
      const root: Root = createRoot(mount.container)

      const render = () => {
        if (mount.surface === "tile") {
          root.render(<TweakersTile store={store} />)
        } else {
          root.render(<TweakersImmersive host={mount.host} store={store} />)
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
