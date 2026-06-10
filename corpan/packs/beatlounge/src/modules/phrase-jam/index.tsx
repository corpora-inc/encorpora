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
import type {
  BeatloungeModule,
  ModuleInstance,
  ModuleMount,
} from "../../contracts/module"
import type { ModuleDeps } from "../allModules"
import type { TrackInit } from "../../model/command"
import { isFragmentTrack } from "../../model/document"
import { newId } from "../../model/ids"
import type { BeatloungeStore } from "../../store/store"
import { createAudioSource, type AudioSource } from "../../phrase/audioSource"
import { phraseJamActions } from "./actions"
import { PhraseJamTile } from "./PhraseJamTile"
import { PhraseJamImmersive } from "./PhraseJamImmersive"
import "./phrase-jam.css"

export const PHRASE_JAM_ID = "phrase-jam"

/** A fresh, empty FragmentTrack to sequence saved snippets on (16-step bar). */
const newPhraseTrack = (): TrackInit => ({
  id: newId("trk"),
  kind: "fragment",
  name: "Phrase Jam",
  color: "#7cf2c0",
  grid: { denominator: 16 },
  volume: 0.8,
  pan: 0,
  mute: false,
  solo: false,
  inserts: [],
  sends: [],
  automation: [],
  instrument: { kind: "ttsFragment" },
  fragments: [],
})

/** Resolve the phrase track id: the bound track, else the first fragment track,
 *  else create one (so the screen always has somewhere to place snippets). */
const resolvePhraseTrackId = (store: BeatloungeStore, fallback?: string): string => {
  if (fallback) return fallback
  const doc = store.vanilla.getState().doc
  const existing = doc.tracks.find(isFragmentTrack)
  if (existing) return existing.id
  const track = newPhraseTrack()
  store.dispatch({ t: "addTrack", track })
  return track.id as string
}

export const createPhraseJamModule = ({ store, audio, host }: ModuleDeps): BeatloungeModule => {
  // One AudioSource per module instance — shared IDB cache across auditions.
  const audioSource: AudioSource = createAudioSource({ hostApi: host.hostApi })

  return {
    id: PHRASE_JAM_ID,
    kind: "sequencer",
    title: "Phrase Jam",
    glyph: "grid",
    immersive: "full",
    tileAspect: "square",
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
        unmount() {
          try { root.unmount() } catch { /* root container already detached */ }
        },
        refreshTile: mount.surface === "tile" ? render : undefined,
      }
    },
  }
}
