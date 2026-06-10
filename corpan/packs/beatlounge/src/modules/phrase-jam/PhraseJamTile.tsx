/**
 * beatlounge — phrase-JAM TILE: a compact glance at the snippet sequencer on the
 * calm Stage. Shows how many bank snippets you have and how many are currently
 * placed on the beat; tapping enters the immersive jam screen (the shell wires
 * the tile's activation). Read-only, glanceable.
 */

import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { isFragmentTrack } from "../../model/document"
import { bankSnippets } from "../../phrase/bank"
import { Glyph } from "../../bl-ui"

interface Props {
  store: BeatloungeStore
}

export const PhraseJamTile = ({ store }: Props) => {
  const { bankCount, placed } = useBeatloungeStore(store, (s) => {
    const bankCount = bankSnippets(s.doc).length
    const placed = s.doc.tracks
      .filter(isFragmentTrack)
      .reduce((n, t) => n + t.fragments.length, 0)
    return { bankCount, placed }
  })

  return (
    <div className="bl-tile-jam">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="grid" size={16} />
        </span>
        <span className="bl-tile-title">Phrase Jam</span>
        <span className="bl-tile-meta">{placed}</span>
      </div>
      <div className="bl-tile-jam-body">
        {bankCount > 0 ? (
          <div className="bl-tile-jam-stat">
            <strong>{bankCount}</strong> snippet{bankCount === 1 ? "" : "s"} in the bank
          </div>
        ) : (
          <div className="bl-tile-jam-hint">
            Save phrases in <strong>Phrases</strong>, then place them on the beat.
          </div>
        )}
      </div>
    </div>
  )
}
