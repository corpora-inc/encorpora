/**
 * beatlounge — Grooves TILE: a compact glance on the calm Stage. Shows the size
 * of the world-rhythm bank and how many hits are currently on the drum track;
 * tapping enters the immersive style picker. Read-only, glanceable.
 *
 * IMPORTANT (zustand v5): select PRIMITIVES, never a fresh object literal, or
 * useSyncExternalStore sees a changed snapshot every render → blank tile.
 */

import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { isInstrumentTrack } from "../../model/document"
import { RHYTHMS } from "../../rhythm"
import { GrooveMark } from "./GrooveMark"

interface Props {
  store: BeatloungeStore
}

export const GroovesTile = ({ store }: Props) => {
  const drumHits = useBeatloungeStore(store, (s) => {
    const drum = s.doc.tracks.find(
      (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
    )
    return drum && isInstrumentTrack(drum) ? drum.notes.length : 0
  })

  return (
    <div className="bl-grooves-tile">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <GrooveMark size={16} />
        </span>
        <span className="bl-tile-title">Grooves</span>
        <span className="bl-tile-meta">{drumHits}</span>
      </div>
      <div className="bl-grooves-tile-body">
        <div className="bl-grooves-tile-stat">
          <strong>{RHYTHMS.length}</strong> world rhythms
        </div>
        <div className="bl-grooves-tile-hint">
          Clave · samba · reggaetón · second-line · talas — Apply, Vary, Evolve.
        </div>
      </div>
    </div>
  )
}
