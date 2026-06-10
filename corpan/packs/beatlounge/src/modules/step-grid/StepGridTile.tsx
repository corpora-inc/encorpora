/**
 * beatlounge — the step-grid TILE: a compact, read-only mini-grid of the drum
 * track (kick / snare / hat lanes) with the live playhead column. Tapping the
 * tile enters immersive (the shell wires the tile's onActivate). Calm, glanceable.
 */

import { useEffect, useMemo, useState } from "react"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { stepForTick } from "../../model/timing"
import { Glyph } from "../../bl-ui"
import { buildMiniView } from "./gridModel"

interface Props {
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
  title: string
}

export const StepGridTile = ({ store, audio, trackId, title }: Props) => {
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
    () => (track && isInstrumentTrack(track) ? buildMiniView(doc, track) : null),
    [doc, track]
  )

  if (!track || !isInstrumentTrack(track) || !view) return null

  return (
    <div className="bl-tile-grid">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="grid" size={16} />
        </span>
        <span className="bl-tile-title">{title}</span>
        <span className="bl-tile-meta">{track.notes.length}</span>
      </div>
      <div
        className="bl-mini"
        style={{ ["--bl-steps" as string]: String(view.steps) }}
        aria-hidden="true"
      >
        {view.lanes.map((lane) => (
          <div className="bl-mini-row" key={lane.pitch}>
            {lane.cells.map((c, s) => (
              <span
                key={s}
                className={
                  "bl-mini-cell" +
                  (c.on ? " is-on" : "") +
                  (s === playStep ? " is-active" : "")
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
