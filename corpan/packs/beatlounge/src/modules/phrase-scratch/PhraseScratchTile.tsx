/**
 * beatlounge — phrase-SCRATCH TILE: a compact glance on the calm Stage. Shows
 * how many bank snippets are available to load onto the turntable; tapping
 * enters the immersive scratch screen. Read-only, glanceable.
 *
 * Selects PRIMITIVES (a count), never a fresh object, so zustand v5's snapshot
 * stays referentially stable (same trap the Phrase Jam tile hit).
 */

import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { bankSnippets } from "../../phrase/bank"
import { Glyph } from "../../bl-ui"

interface Props {
  store: BeatloungeStore
}

export const PhraseScratchTile = ({ store }: Props) => {
  const bankCount = useBeatloungeStore(store, (s) => bankSnippets(s.doc).length)

  return (
    <div className="bl-tile-scr">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="wave" size={16} />
        </span>
        <span className="bl-tile-title">Scratch</span>
      </div>
      <div className="bl-tile-scr-body">
        <span className="bl-tile-scr-disc" aria-hidden="true">
          <span className="bl-tile-scr-disc-label" />
        </span>
        {bankCount > 0 ? (
          <div className="bl-tile-scr-stat">
            <strong>{bankCount}</strong> snippet{bankCount === 1 ? "" : "s"} to scratch
          </div>
        ) : (
          <div className="bl-tile-scr-hint">
            Save a phrase in <strong>Phrases</strong>, then scratch it like vinyl.
          </div>
        )}
      </div>
    </div>
  )
}
