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
import { ct } from "../../i18n/strings"

interface Props {
  store: BeatloungeStore
}

export const PhraseJamTile = ({ store }: Props) => {
  // IMPORTANT: select PRIMITIVES, not a fresh object. Returning a new object
  // literal from the selector makes zustand v5's useSyncExternalStore see a
  // changed snapshot every render → infinite re-render loop → React bails and
  // the tile renders blank. Two scalar selectors keep snapshots referentially
  // stable. (This was the root cause of the blank Phrase Jam tile.)
  const bankCount = useBeatloungeStore(store, (s) => bankSnippets(s.doc).length)
  const placed = useBeatloungeStore(store, (s) =>
    s.doc.tracks
      .filter(isFragmentTrack)
      .reduce((n, t) => n + t.fragments.length, 0)
  )

  return (
    <div className="bl-tile-jam">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="grid" size={16} />
        </span>
        <span className="bl-tile-title">{ct("jam.title")}</span>
        <span className="bl-tile-meta">{placed}</span>
      </div>
      <div className="bl-tile-jam-body">
        {bankCount > 0 ? (
          <div className="bl-tile-jam-stat">
            {bankCount === 1
              ? ct("jam.tileInBankOne", { n: String(bankCount) })
              : ct("jam.tileInBank", { n: String(bankCount) })}
          </div>
        ) : (
          <div className="bl-tile-jam-hint">{ct("jam.tileHint")}</div>
        )}
      </div>
    </div>
  )
}
