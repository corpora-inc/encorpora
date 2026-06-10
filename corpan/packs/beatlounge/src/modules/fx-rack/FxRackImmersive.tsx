/**
 * beatlounge — the fx-rack IMMERSIVE view: the full per-track effects rack.
 *
 *  • Track switcher (chips) so one rack module edits any track.
 *  • Insert chain + add menu + per-effect params + sends — all delegated to the
 *    reusable <TrackFxChain> (the SAME component the Drums page embeds), so the
 *    realtime param wiring + layout live in one place.
 *
 * Every gesture is one command → one undo step. The store is the only write path.
 */

import { useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, type Id } from "../../model/document"
import { TrackFxChain } from "./TrackFxChain"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  trackId: Id
}

export const FxRackImmersive = ({ host, store, trackId: initialTrackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const [trackId, setTrackId] = useState<Id>(initialTrackId)

  const track = findTrack(doc, trackId) ?? doc.tracks[0]
  if (!track) return <div className="bl-grid-empty">No track.</div>

  return (
    <div className="bl-fxrack">
      <div className="bl-fxrack-bar" data-bl-nocapture>
        <div className="bl-fxrack-tracks">
          {doc.tracks.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`bl-chip${t.id === track.id ? " is-on" : ""}`}
              onClick={() => setTrackId(t.id)}
            >
              <span className="bl-dot" style={{ background: t.color ?? "var(--bl-accent)" }} />
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <TrackFxChain host={host} store={store} trackId={track.id} />
    </div>
  )
}
