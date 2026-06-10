/**
 * beatlounge — phrase-sampler TILE: a compact "current phrase" summary on the
 * calm Stage. Shows the most-recently-placed phrase (target + gloss) and the
 * count of sampler tracks in the song; tapping enters the immersive browser
 * (the shell wires the tile's activation). Glanceable, read-only.
 */

import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { isFragmentTrack } from "../../model/document"
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
  const samplerCount = useBeatloungeStore(
    store,
    (s) => s.doc.tracks.filter(isFragmentTrack).length
  )

  return (
    <div className="bl-tile-ps">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="wave" size={16} />
        </span>
        <span className="bl-tile-title">Phrase Sampler</span>
        <span className="bl-tile-meta">{samplerCount}</span>
      </div>
      <div className="bl-tile-ps-body">
        {current ? (
          <>
            <div className="bl-tile-ps-target">{current.target || "—"}</div>
            {current.gloss && <div className="bl-tile-ps-gloss">{current.gloss}</div>}
          </>
        ) : (
          <div className="bl-tile-ps-hint">
            Browse 25k phrases — place a word as a pitched instrument.
          </div>
        )}
      </div>
    </div>
  )
}
