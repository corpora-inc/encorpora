/**
 * beatlounge — the phrase-JAM module (kind "sequencer"): the drum sequencer for
 * SAVED PHRASE SNIPPETS + a live pitch ribbon to perform with. Mirrors the
 * step-grid / phrase-sampler module shape — a factory binds store + audio + host
 * and returns a BeatloungeModule whose `mount()` renders the tile or the
 * immersive jam screen into the host container via its own React root.
 *
 * It binds to the doc's FragmentTrack (the first kind:"fragment" track); if none
 * exists it creates one via `addTrack` so the user always has a phrase track to
 * sequence on. It owns an AudioSource (built from the host's HostApi) so
 * auditions share the IDB cache with the rest of the pack. The `scramble` action
 * is exposed so the LLM command bus can re-roll the grid by natural language.
 */

import { createRoot, type Root } from "react-dom/client"
import { makeDeferredUnmount } from "../_shared/deferUnmount"
import type {
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { ModuleDeps } from "../allModules"
import type { TrackInit } from "../../model/command"
import { isFragmentTrack, newFragmentTrack } from "../../model/document"
import type { BeatloungeStore } from "../../store/store"
import { createAudioSource, type AudioSource } from "../../phrase/audioSource"
import { phraseJamActions } from "./actions"
import { PhraseJamTile } from "./PhraseJamTile"
import { PhraseJamImmersive } from "./PhraseJamImmersive"
import { ct } from "../../i18n/strings"
import "./phrase-jam.css"

export const PHRASE_JAM_ID = "phrase-jam"

/** Resolve the phrase track id: the bound track, else the first fragment track,
 *  else create one (so the screen always has somewhere to place snippets). New
 *  docs + migrated docs already carry a singular "Phrases" fragment track (see
 *  model/document.ts), so this almost always finds the existing one — the lazy
 *  create is just a backstop. Uses the SAME shared `newFragmentTrack` factory. */
const resolvePhraseTrackId = (store: BeatloungeStore, fallback?: string): string => {
  if (fallback) return fallback
  const doc = store.vanilla.getState().doc
  const existing = doc.tracks.find(isFragmentTrack)
  if (existing) return existing.id
  const track: TrackInit = newFragmentTrack()
  store.dispatch({ t: "addTrack", track })
  return track.id as string
}

export const createPhraseJamModule = ({ store, audio, host }: ModuleDeps): BeatloungeModule => {
  // One AudioSource per module instance — shared IDB cache across auditions.
  const audioSource: AudioSource = createAudioSource({ hostApi: host.hostApi })

  return {
    id: PHRASE_JAM_ID,
    kind: "sequencer",
    title: ct("jam.title"),
    glyph: "grid",
    immersive: "full",
    tileAspect: "third",
    actions: phraseJamActions,
    mount(mount: ModuleMount): ModuleInstance {
      const root: Root = createRoot(mount.container)

      const render = () => {
        if (mount.surface === "tile") {
          root.render(<PhraseJamTile store={store} />)
          return
        }
        // Immersive: ensure a phrase track exists before rendering.
        const trackId = resolvePhraseTrackId(store, mount.trackId)
        root.render(
          <PhraseJamImmersive
            host={mount.host}
            store={store}
            audio={audio}
            audioSource={audioSource}
            trackId={trackId}
          />
        )
      }

      render()

      return {
        unmount: makeDeferredUnmount(root),
        refreshTile: mount.surface === "tile" ? render : undefined,
      }
    },
  }
}
