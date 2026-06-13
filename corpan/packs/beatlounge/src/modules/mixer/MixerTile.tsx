/**
 * beatlounge — the mixer TILE: a compact, read-only mini-console. One slim
 * meter per track (lit by the synthetic playhead pulse) over a row of track
 * dots. Tapping enters the full console. Calm + glanceable.
 */

import { useMemo } from "react"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { Glyph, Meter } from "../../bl-ui"
import { useMeterPulse } from "./useMeterPulse"
import { ct } from "../../i18n/strings"

interface Props {
  store: BeatloungeStore
  audio: AudioFacade
}

export const MixerTile = ({ store, audio }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const ids = useMemo(() => doc.tracks.map((t) => t.id), [doc.tracks])
  const levels = useMeterPulse(store, audio, ids)

  return (
    <div className="bl-tile-grid">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="sliders" size={16} />
        </span>
        <span className="bl-tile-title">{ct("mixer.title")}</span>
        <span className="bl-tile-meta">{doc.tracks.length}</span>
      </div>
      <div className="bl-mixtile" aria-hidden="true">
        {doc.tracks.map((t) => (
          <div className="bl-mixtile-ch" key={t.id}>
            <Meter level={levels[t.id] ?? 0} segments={8} />
            <span className="bl-dot" style={{ background: t.color ?? "var(--bl-accent)" }} />
          </div>
        ))}
      </div>
    </div>
  )
}
