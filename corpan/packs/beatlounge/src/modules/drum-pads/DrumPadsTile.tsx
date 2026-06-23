/**
 * beatlounge — the drum-pads TILE: a compact, read-only pad preview. A small
 * 4×2 grid of the lead pads, each lighting when its lane fires on the live
 * playhead step and showing its hit count. Tapping enters immersive.
 */

import { useEffect, useMemo, useState } from "react"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { stepForTick } from "../../model/timing"
import { Glyph } from "../../bl-ui"
import { buildPadView } from "./padModel"

interface Props {
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
  title: string
}

const TILE_PADS = 8

export const DrumPadsTile = ({ store, audio, trackId, title }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  const [playStep, setPlayStep] = useState(-1)

  useEffect(() => {
    return audio.onPlayhead((tick) => {
      const t = findTrack(store.vanilla.getState().doc, trackId)
      setPlayStep(tick < 0 || !t ? -1 : stepForTick(tick, t.grid))
    })
  }, [audio, store, trackId])

  const view = useMemo(
    () =>
      track && isInstrumentTrack(track)
        ? buildPadView(doc, track, playStep)
        : null,
    [doc, track, playStep]
  )

  if (!track || !isInstrumentTrack(track) || view == null) return null

  // Show the canonical kit (the last four) + the first extras for a tidy 4×2.
  const lead = [...view.pads.slice(-4), ...view.pads.slice(0, 4)].slice(0, TILE_PADS)
  const total = track.notes.length

  return (
    <div className="bl-tile-grid">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="grid" size={16} />
        </span>
        <span className="bl-tile-title">{title}</span>
        <span className="bl-tile-meta">{total}</span>
      </div>
      <div className="bl-pad-mini" aria-hidden="true">
        {lead.map((p) => (
          <span
            key={p.pitch}
            className={
              "bl-pad-mini-cell" +
              (p.count > 0 ? " has-hits" : "") +
              (p.liveHit && playStep >= 0 ? " is-live" : "")
            }
          />
        ))}
      </div>
    </div>
  )
}
