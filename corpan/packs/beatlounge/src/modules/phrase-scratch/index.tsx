/**
 * beatlounge — the phrase-SCRATCH module (kind "browser"): the headline
 * turntable. Isolate ONE saved phrase snippet and SCRATCH IT LIKE A RECORD —
 * continuous, click-free, forward and reverse — driven by the finger.
 *
 * Mirrors the phrase-jam / phrase-sampler module shape: a factory binds store +
 * audio + host and returns a BeatloungeModule whose `mount()` renders the tile
 * or the immersive turntable into the host container via its own React root.
 *
 * It owns an AudioSource (built from the host's HostApi) so loading a snippet's
 * audio shares the IDB cache with the rest of the pack. The live scratch engine
 * plays DIRECTLY on `host.audioContext()` (not the transport) — a performance
 * instrument the widget drives by hand, like `auditionPhrase`.
 *
 * No LLM actions: scratching is a live, hand-driven performance with no document
 * mutation, so the action registry is intentionally empty.
 */

import { createRoot, type Root } from "react-dom/client"
import { makeDeferredUnmount } from "../_shared/deferUnmount"
import type {
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { ModuleDeps } from "../allModules"
import { createAudioSource, type AudioSource } from "../../phrase/audioSource"
import { PhraseScratchTile } from "./PhraseScratchTile"
import { PhraseScratchImmersive } from "./PhraseScratchImmersive"
import "./phrase-scratch.css"

export const PHRASE_SCRATCH_ID = "phrase-scratch"

export const createPhraseScratchModule = ({
  store,
  host,
}: ModuleDeps): BeatloungeModule => {
  // One AudioSource per module instance — shared IDB cache across loads.
  const audioSource: AudioSource = createAudioSource({ hostApi: host.hostApi })

  return {
    id: PHRASE_SCRATCH_ID,
    kind: "browser",
    title: "Scratch",
    glyph: "wave",
    immersive: "full",
    tileAspect: "square",
    actions: [],
    mount(mount: ModuleMount): ModuleInstance {
      const root: Root = createRoot(mount.container)

      const renderTile = () => {
        root.render(<PhraseScratchTile store={store} />)
      }

      const render = () => {
        if (mount.surface === "tile") {
          renderTile()
          return
        }
        root.render(
          <PhraseScratchImmersive
            host={mount.host}
            store={store}
            audioSource={audioSource}
          />
        )
      }

      render()

      return {
        unmount: makeDeferredUnmount(root),
        refreshTile: mount.surface === "tile" ? renderTile : undefined,
      }
    },
  }
}
