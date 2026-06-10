/**
 * beatlounge — the synth-analog TILE: a calm, glanceable summary of the bound
 * track's analog patch — the preset name, the two oscillator waves, and a
 * filter cutoff × resonance readout. Tapping enters the immersive surface. When
 * the bound track isn't an analog synth yet, the tile invites making it one.
 */

import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { Glyph } from "../../bl-ui"
import { defaultAnalogParams, numParam } from "../../instruments/analogSynth"

interface Props {
  store: BeatloungeStore
  trackId: Id
}

const fmtFreq = (v: number): string => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0))

export const SynthAnalogTile = ({ store, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  if (!track || !isInstrumentTrack(track)) return null

  const analog =
    track.instrument.kind === "analogSynth" ? track.instrument : null

  if (!analog) {
    return (
      <div className="bl-tile-grid">
        <div className="bl-tile-head">
          <span className="bl-tile-glyph">
            <Glyph name="wave" size={16} />
          </span>
          <span className="bl-tile-title">Analog</span>
        </div>
        <div className="bl-synthtile-body">
          <span className="bl-synthtile-empty">Tap to make {track.name} analog</span>
        </div>
      </div>
    )
  }

  const params = { ...defaultAnalogParams(), ...analog.params }
  const preset = analog.preset ?? "custom"
  const cutoff = numParam(params, "cutoff")
  const reso = numParam(params, "resonance")

  return (
    <div className="bl-tile-grid">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="wave" size={16} />
        </span>
        <span className="bl-tile-title">{track.name}</span>
        <span className="bl-tile-meta">{preset}</span>
      </div>
      <div className="bl-synthtile-body" aria-hidden="true">
        <div className="bl-synthtile-waves">
          <span className="bl-synthtile-pill">{String(params.osc1Wave)}</span>
          <span className="bl-synthtile-pill">{String(params.osc2Wave)}</span>
        </div>
        <div className="bl-synthtile-filter">
          <span className="bl-synthtile-key">Cutoff</span>
          <span className="bl-synthtile-val">{fmtFreq(cutoff)} Hz</span>
          <span className="bl-synthtile-key">Reso</span>
          <span className="bl-synthtile-val">{reso.toFixed(1)}</span>
        </div>
      </div>
    </div>
  )
}
