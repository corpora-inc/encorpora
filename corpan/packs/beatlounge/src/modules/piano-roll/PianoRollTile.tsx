/**
 * beatlounge — the piano-roll TILE: a compact, read-only note-cloud preview of
 * the melodic track. Notes plot as dots positioned by (step → x, pitch → y)
 * across the loop, with the live playhead column. Tapping enters immersive.
 * Calm, glanceable — a tiny constellation of the melody.
 */

import { useEffect, useMemo, useState } from "react"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { stepForTick } from "../../model/timing"
import { Glyph } from "../../bl-ui"
import { buildCloud } from "./tileModel"

interface Props {
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
  title: string
}

export const PianoRollTile = ({ store, audio, trackId, title }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  const [playStep, setPlayStep] = useState(-1)

  useEffect(() => {
    return audio.onPlayhead((tick) => {
      const t = findTrack(store.vanilla.getState().doc, trackId)
      setPlayStep(tick < 0 || !t ? -1 : stepForTick(tick, t.grid))
    })
  }, [audio, store, trackId])

  const cloud = useMemo(
    () => (track && isInstrumentTrack(track) ? buildCloud(doc, track) : null),
    [doc, track]
  )

  if (!track || !isInstrumentTrack(track) || cloud == null) return null

  const playX = playStep >= 0 && cloud.steps > 0 ? (playStep / cloud.steps) * 100 : -1

  return (
    <div className="bl-tile-grid">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="wave" size={16} />
        </span>
        <span className="bl-tile-title">{title}</span>
        <span className="bl-tile-meta">{track.notes.length}</span>
      </div>
      <div className="bl-roll-cloud" aria-hidden="true">
        {playX >= 0 && (
          <span className="bl-roll-cloud-play" style={{ left: `${playX}%` }} />
        )}
        {cloud.dots.map((d, i) => (
          <span
            key={i}
            className={"bl-roll-dot" + (d.active === playStep ? " is-active" : "")}
            style={{
              left: `${d.x * 100}%`,
              bottom: `${d.y * 100}%`,
              opacity: 0.45 + d.velocity * 0.55,
            }}
          />
        ))}
      </div>
    </div>
  )
}
