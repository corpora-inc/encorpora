/**
 * beatlounge — instruments TILE: a compact summary of the SELECTED synth track's
 * current voice (its track name + preset/voice label + family). It binds to the
 * SAME persisted selection the Instruments page uses (`useSelectedInstrument`),
 * so picking a different synth on the page updates this tile reactively — no
 * per-frame churn (a selective store subscription, re-render only on change).
 * Calm and glanceable; tapping enters the immersive instrument browser.
 */

import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { useSelectedInstrument } from "../../store/selectedInstrument"
import { Glyph } from "../../bl-ui"
import { gmFamilyOf } from "../../instruments/gmPrograms"
import { FAMILY_LABEL, matchPreset } from "../../instruments/presets"
import { VOICE_TYPE_LABEL, voiceTypeOf } from "../../instruments/voiceTypes"
import { instrumentSummary } from "./instrumentSummary"

interface Props {
  store: BeatloungeStore
  /** Mount fallback when nothing has been selected yet (first paint). */
  trackId: Id
}

export const InstrumentsTile = ({ store, trackId: fallbackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  // Bind to the persisted, page-shared selection (resolves against the live doc).
  const { trackId } = useSelectedInstrument(doc)
  const track = findTrack(doc, trackId ?? fallbackId)
  if (!track || !isInstrumentTrack(track)) return null

  const config = track.instrument
  const preset = matchPreset(config)
  // The voice label: the preset name if the config matches one, else the raw
  // engine summary (e.g. "Synth (triangle)" for a hand-picked oscillator).
  const name = preset?.name ?? instrumentSummary(config)
  // The family/voice-type chip: GM family for soundfonts, preset family for a
  // matched preset, else the player-facing voice type (Analog / Osc).
  const family =
    config.kind === "soundfont" && config.bank !== 128
      ? gmFamilyOf(config.program)?.label
      : config.kind === "soundfont"
        ? "Drums"
        : preset
          ? FAMILY_LABEL[preset.family]
          : VOICE_TYPE_LABEL[voiceTypeOf(config)]

  return (
    <div className="bl-tile-grid">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="drawer" size={16} />
        </span>
        <span className="bl-tile-title">{track.name}</span>
        <span className="bl-tile-meta">{family}</span>
      </div>
      <div className="bl-instr-tile" aria-hidden="true">
        <span className="bl-instr-tile-name">{name}</span>
        {config.kind === "soundfont" && (
          <span className="bl-instr-tile-prog">
            {config.bank === 128 ? "drum kit" : `program ${config.program}`}
          </span>
        )}
      </div>
    </div>
  )
}
