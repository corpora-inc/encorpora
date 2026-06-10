/**
 * beatlounge — the phrase-sampler module (kind "browser"). The language-learning
 * soul of the pack: browse / search / randomize the 25k-phrase corpus, audition
 * a phrase's TTS, and PLACE it as a pitch-performable sampler track (the same
 * word re-pitched up the scale = a riff).
 *
 * A factory binds the store + audio + host and returns a BeatloungeModule whose
 * `mount()` renders the tile or the immersive browser into the host container
 * via its own React root (matching step-grid). It owns an AudioSource (built
 * from the host's HostApi) so audio resolution + IDB caching are shared across
 * placements, and keeps the "last placed phrase" in closure so the tile reflects
 * it across mounts.
 *
 * The action registry (placeRandom) is exposed so the future LLM command bus can
 * drop a phrase by natural language — no shell change.
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
import type { EntryOut } from "../../sdk/types"
import { createAudioSource, type AudioSource } from "../../phrase/audioSource"
import { PhraseSamplerImmersive } from "./PhraseSamplerImmersive"
import { PhraseSamplerTile, type CurrentPhrase } from "./PhraseSamplerTile"
import { phraseSamplerActions } from "./actions"
import { resolvePhraseContent } from "../../phrase/pipeline"
import "./phrase-sampler.css"

export interface PhraseSamplerDeps {
  store: BeatloungeStore
  audio: AudioFacade
  host: BeatloungeHost
}

export const PHRASE_SAMPLER_ID = "phrase-sampler"

export const createPhraseSamplerModule = ({
  store,
  host,
}: PhraseSamplerDeps): BeatloungeModule => {
  // One AudioSource per module instance — shared cache across placements.
  const audioSource: AudioSource = createAudioSource({ hostApi: host.hostApi })

  // Last-placed phrase summary, surfaced on the tile. Notifies live tiles.
  let current: CurrentPhrase | null = null
  const tileRoots = new Set<{ render: () => void }>()
  const setCurrent = (entry: EntryOut, summary: string) => {
    const content = resolvePhraseContent(entry, host.hostApi.getStackConfig().languages)
    current = { target: content.phraseText, gloss: content.gloss, summary }
    for (const r of tileRoots) r.render()
  }

  return {
    id: PHRASE_SAMPLER_ID,
    kind: "browser",
    title: "Phrases",
    glyph: "wave",
    immersive: "full",
    tileAspect: "wide",
    actions: phraseSamplerActions,
    mount(mount: ModuleMount): ModuleInstance {
      const root: Root = createRoot(mount.container)

      const renderImmersive = () => {
        root.render(
          <PhraseSamplerImmersive
            host={mount.host}
            store={store}
            audioSource={audioSource}
            onPlaced={(entry, summary) => setCurrent(entry, summary)}
          />
        )
      }

      const renderTile = () => {
        root.render(<PhraseSamplerTile store={store} current={current} />)
      }

      const tileHandle = { render: renderTile }

      if (mount.surface === "tile") {
        tileRoots.add(tileHandle)
        renderTile()
      } else {
        renderImmersive()
      }

      return {
        unmount() {
          tileRoots.delete(tileHandle)
          queueMicrotask(() => root.unmount())
        },
        refreshTile: mount.surface === "tile" ? renderTile : undefined,
      }
    },
  }
}
