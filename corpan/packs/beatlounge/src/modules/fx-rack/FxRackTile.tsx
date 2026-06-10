/**
 * beatlounge — the fx-rack TILE: a compact, read-only summary of a track's
 * insert chain (effect-kind pills, dimmed when bypassed) + a send count. Calm
 * and glanceable; tapping enters the immersive rack (shell wires onActivate).
 */

import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, type Id } from "../../model/document"
import { Glyph } from "../../bl-ui"
import { EFFECT_SPECS } from "../../effects/params"

interface Props {
  store: BeatloungeStore
  trackId: Id
}

export const FxRackTile = ({ store, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  if (!track) return null

  const inserts = track.inserts
  const sends = track.sends.length

  return (
    <div className="bl-tile-grid">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="sliders" size={16} />
        </span>
        <span className="bl-tile-title">{track.name}</span>
        <span className="bl-tile-meta">{inserts.length}</span>
      </div>
      <div className="bl-fxtile-chain" aria-hidden="true">
        {inserts.length === 0 ? (
          <span className="bl-fxtile-empty">No effects</span>
        ) : (
          inserts.map((fx) => (
            <span
              key={fx.id}
              className={`bl-fxtile-pill${fx.enabled ? "" : " is-off"}`}
            >
              {EFFECT_SPECS[fx.kind].label}
            </span>
          ))
        )}
      </div>
      {sends > 0 && (
        <div className="bl-fxtile-sends" aria-hidden="true">
          {sends} send{sends === 1 ? "" : "s"}
        </div>
      )}
    </div>
  )
}
