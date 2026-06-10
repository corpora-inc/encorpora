/**
 * beatlounge — the Song Setup module (kind "utility"): the premium Song surface
 * that defines the piece at the global top level — loop length (up to 128
 * beats), any time signature (incl. exotic meters), long world CYCLES (Indian
 * talas + a few world rhythms), tempo, and swing.
 *
 * Mirrors step-grid / mixer: a `createSongSetupModule(deps)` factory binds the
 * store and renders its own React root into the host container (tile or
 * immersive). The action registry is exposed so the command bus can index it.
 *
 * The "last loaded cycle" id is module-instance state (not in the model — the
 * doc has no cycle/accent concept) so the tile can name the tala and the
 * immersive view can seed its accent map. It survives tile↔immersive re-renders
 * within one mounted instance.
 */

import { createRoot, type Root } from "react-dom/client"
import type {
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { songSetupActions } from "./actions"
import { SongSetupTile } from "./SongSetupTile"
import { SongSetupImmersive } from "./SongSetupImmersive"
import "./styles.css"

export interface SongSetupDeps {
  store: BeatloungeStore
}

export const SONG_SETUP_ID = "song-setup"

export const createSongSetupModule = ({ store }: SongSetupDeps): BeatloungeModule => ({
  id: SONG_SETUP_ID,
  kind: "utility",
  title: "Song",
  glyph: "metronome",
  immersive: "full",
  tileAspect: "wide",
  actions: songSetupActions,
  mount(mount: ModuleMount): ModuleInstance {
    const root: Root = createRoot(mount.container)
    // Per-instance "last loaded cycle" — lets the tile name the tala and the
    // immersive seed its accent map. Not persisted to the model by design.
    let cycleId: string | undefined

    const render = () => {
      if (mount.surface === "tile") {
        root.render(<SongSetupTile store={store} cycleId={cycleId} />)
      } else {
        root.render(
          <SongSetupImmersive
            store={store}
            host={mount.host}
            cycleId={cycleId}
            onCycle={(id) => {
              cycleId = id
              render()
            }}
          />
        )
      }
    }

    render()

    return {
      unmount() {
        queueMicrotask(() => root.unmount())
      },
      refreshTile: render,
    }
  },
})
