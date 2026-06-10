/**
 * beatlounge — the ribbon TILE: a calm, compact preview on the Stage. Shows the
 * current key + mode and a static fret strip (the in-scale degrees the player
 * will snap to), with the tonic accented. Tapping the tile enters immersive
 * (the shell wires that); the tile itself is non-interactive so taps pass to the
 * shell's tile chrome.
 */

import { useMemo } from "react"
import {
  KEY_NAMES,
  modeLabel,
  ribbonFrets,
  type RibbonWindow,
  type ScaleMode,
} from "../../music/ribbonScales"

interface Props {
  /** Defaults mirror the immersive view's opening state. */
  keyPc?: number
  mode?: ScaleMode
  color?: string
}

const TILE_WIN: RibbonWindow = { lowMidi: 48, spanSemis: 24 } // a tidy 2-octave preview

export const RibbonTile = ({ keyPc = 0, mode = "major", color }: Props) => {
  const frets = useMemo(() => ribbonFrets(TILE_WIN, keyPc, mode), [keyPc, mode])

  return (
    <div className="bl-ribbon-tile">
      <div className="bl-ribbon-tile-head">
        <span className="bl-dot" style={{ background: color }} />
        <span className="bl-ribbon-tile-title">Ribbon</span>
        <span className="bl-ribbon-tile-key">
          {KEY_NAMES[keyPc]} {modeLabel(mode)}
        </span>
      </div>
      <div className="bl-ribbon-tile-strip" aria-hidden="true">
        {frets.map((f) => (
          <span
            key={f.midi}
            className={`bl-ribbon-tile-fret${f.tonic ? " is-tonic" : ""}`}
            style={{ left: `${f.x * 100}%` }}
          />
        ))}
      </div>
    </div>
  )
}
