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
import { ct } from "../../i18n/strings"

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
        <span className="bl-tile-title">{ct("scratch.title")}</span>
      </div>
      <div className="bl-tile-scr-body">
        <span className="bl-tile-scr-disc" aria-hidden="true">
          <span className="bl-tile-scr-disc-label" />
        </span>
        {bankCount > 0 ? (
          <div className="bl-tile-scr-stat">
            {bankCount === 1
              ? ct("scratch.tileToScratchOne", { n: String(bankCount) })
              : ct("scratch.tileToScratch", { n: String(bankCount) })}
          </div>
        ) : (
          <div className="bl-tile-scr-hint">{ct("scratch.tileHint")}</div>
        )}
      </div>
    </div>
  )
}
