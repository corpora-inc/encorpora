/**
 * beatlounge — the Composer TILE: a calm, glanceable summary of the synth's
 * current note material — a count + a tiny chord-density spark. Tapping enters
 * the immersive Composer surface. Read-only; the harmony work happens inside.
 */

import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { Glyph } from "../../bl-ui"
import { ct } from "../../i18n/strings"

interface Props {
  store: BeatloungeStore
  trackId: Id
  title: string
}

export const ComposerTile = ({ store, trackId, title }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  if (!track || !isInstrumentTrack(track)) return null

  // A tiny pitch-spark of the current notes across the loop.
  const notes = track.notes
  const loop = Math.max(1, doc.loopLengthTicks)
  const lo = notes.length ? Math.min(...notes.map((n) => n.pitch)) : 60
  const hi = notes.length ? Math.max(...notes.map((n) => n.pitch)) : 72
  const span = Math.max(1, hi - lo)

  return (
    <div className="bl-cmp-tile">
      <div className="bl-cmp-tile-head">
        <span className="bl-cmp-tile-glyph">
          <Glyph name="wave" size={16} />
        </span>
        <span className="bl-cmp-tile-title">{title}</span>
        <span className="bl-cmp-tile-meta">{notes.length}</span>
      </div>
      <div className="bl-cmp-spark" aria-hidden="true">
        {notes.map((n, i) => (
          <span
            key={i}
            className="bl-cmp-spark-dot"
            style={{
              left: `${(n.tick / loop) * 100}%`,
              bottom: `${((n.pitch - lo) / span) * 100}%`,
              opacity: 0.4 + n.velocity * 0.6,
            }}
          />
        ))}
        {notes.length === 0 && <span className="bl-cmp-tile-empty">{ct("harmony.tapToCompose")}</span>}
      </div>
    </div>
  )
}
