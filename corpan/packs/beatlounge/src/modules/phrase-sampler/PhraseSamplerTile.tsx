/**
 * beatlounge — phrase DISCOVERY TILE: a compact summary on the calm Stage.
 * Shows the size of the saved phrase BANK and the most-recently-saved snippet;
 * tapping enters the immersive Discovery/Library screen (the shell wires the
 * tile's activation). Glanceable, read-only.
 */

import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { Glyph } from "../../bl-ui"

export interface CurrentPhrase {
  target: string
  gloss: string
  summary: string
}

interface Props {
  store: BeatloungeStore
  current: CurrentPhrase | null
}

export const PhraseSamplerTile = ({ store, current }: Props) => {
  const bankCount = useBeatloungeStore(
    store,
    (s) => s.doc.fragmentLibrary?.length ?? 0
  )
  const lastSaved = useBeatloungeStore(
    store,
    (s) => s.doc.fragmentLibrary?.[s.doc.fragmentLibrary.length - 1]?.text ?? null
  )

  return (
    <div className="bl-tile-ps">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="wave" size={16} />
        </span>
        <span className="bl-tile-title">Phrases</span>
        <span className="bl-tile-meta">{bankCount}</span>
      </div>
      <div className="bl-tile-ps-body">
        {bankCount > 0 ? (
          <>
            <div className="bl-tile-ps-target">{current?.target || lastSaved || "—"}</div>
            <div className="bl-tile-ps-gloss">
              {bankCount} {bankCount === 1 ? "snippet" : "snippets"} in bank
            </div>
          </>
        ) : (
          <div className="bl-tile-ps-hint">Discover phrases across your stack</div>
        )}
      </div>
    </div>
  )
}
