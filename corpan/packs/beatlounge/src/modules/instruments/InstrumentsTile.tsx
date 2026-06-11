/**
 * beatlounge — instruments TILE: a compact summary of the bound track's current
 * instrument (its GM voice name + family, or its synthesis-engine kind). Calm
 * and glanceable; tapping enters the immersive instrument browser.
 */

import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { Glyph } from "../../bl-ui"
import { gmFamilyOf } from "../../instruments/gmPrograms"
import { FAMILY_LABEL, matchPreset } from "../../instruments/presets"
import { instrumentSummary } from "./instrumentSummary"

interface Props {
  store: BeatloungeStore
  trackId: Id
}

export const InstrumentsTile = ({ store, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  if (!track || !isInstrumentTrack(track)) return null

  const config = track.instrument
  const preset = matchPreset(config)
  const name = preset?.name ?? instrumentSummary(config)
  const family =
    config.kind === "soundfont" && config.bank !== 128
      ? gmFamilyOf(config.program)?.label
      : config.kind === "soundfont"
        ? "Drums"
        : preset
          ? FAMILY_LABEL[preset.family]
          : "Synthesis"

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
