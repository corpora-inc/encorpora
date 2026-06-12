/**
 * beatlounge — the HARMONY tile's immersive view. A THIN WRAPPER now: the
 * harmony bar itself (tonic + Mode⇄Progression + chord grid + 994 browser +
 * note row) lives in the reusable <HarmonyPanel> so it can ALSO mount at the top
 * of the Instruments page. This file adds the head + the "jam onto the synth"
 * controls (Density / Feel / Jam·Re-roll·Evolve) that are specific to the
 * standalone Harmony surface — performance, not harmony.
 *
 * Behavior is unchanged: same commands, same jam, and the harmony bar now ALSO
 * snaps the bound synth's melody into the new key on a mode/progression change
 * (HarmonyPanel's `snapTrackId`), which is purely additive (closest-in-key,
 * setup-don't-play).
 */

import { useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioFacade } from "../../contracts/audioFacade"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { Knob } from "../../bl-ui"
import { HarmonyPanel } from "./HarmonyPanel"
import {
  COMPOSER_FEELS,
  composeFromHarmony,
  defaultComposerSettings,
  nextEvolveSeed,
  rollSeed,
  type ComposerSettings,
} from "./composerState"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
}

export const ComposerImmersive = ({ host, store, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)

  const [settings, setSettings] = useState<ComposerSettings>(defaultComposerSettings)

  // ---- jam onto the synth (performance, not harmony) -----------------------
  const compose = (seed: number, label: string) => {
    const next = { ...settings, seed }
    setSettings(next)
    const { commands, noteCount, chordCount } = composeFromHarmony(
      store.vanilla.getState().doc,
      next,
      trackId
    )
    if (!commands.length) {
      host.toast("Set a mode or some chords first")
      return
    }
    const before = store.vanilla.getState().doc
    store.dispatch({ t: "batch", label, commands })
    host.toast(`${label}: ${noteCount} notes over ${chordCount} chords`, {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
  }
  const onJam = () => compose(settings.seed || rollSeed(), "Jam")
  const onReroll = () => compose(rollSeed(), "Re-roll")
  const onEvolve = () => compose(nextEvolveSeed(settings.seed || 1), "Evolve")

  if (!track || !isInstrumentTrack(track)) {
    return <div className="bl-grid-empty">No synth track to compose onto.</div>
  }

  return (
    <div className="bl-hb-wrap">
      <div className="bl-hb-head" data-bl-nocapture>
        <span className="bl-hb-sub">{track.name}</span>
      </div>

      <HarmonyPanel host={host} store={store} snapTrackId={trackId} />

      {/* ---- jam onto the synth ---- */}
      <div className="bl-hb-jam" data-bl-nocapture>
        <Knob
          label="Density"
          value={settings.density}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.55}
          format={(v) => `${Math.round(v * 100)}`}
          onChange={(v) => setSettings((s) => ({ ...s, density: v }))}
        />
        <select
          className="bl-hb-select bl-hb-feel"
          value={settings.feel}
          aria-label="Feel"
          onChange={(e) => setSettings((s) => ({ ...s, feel: e.target.value as ComposerSettings["feel"] }))}
        >
          {COMPOSER_FEELS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <div className="bl-hb-jam-btns">
          <button type="button" className="bl-chip is-primary" onClick={onJam}>
            Jam
          </button>
          <button type="button" className="bl-chip" onClick={onReroll}>
            Re-roll
          </button>
          <button type="button" className="bl-chip" onClick={onEvolve}>
            Evolve
          </button>
        </div>
      </div>
    </div>
  )
}
