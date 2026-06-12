/**
 * beatlounge — the ribbon TILE: a calm, compact preview on the Stage. Shows the
 * song's current key + harmony and a static fret strip (the in-harmony degrees
 * the player will snap to), with the tonic accented. It FOLLOWS the global
 * harmony (doc.harmony via the resolver) — same source the immersive ribbon and
 * the piano-roll use. Tapping the tile enters immersive; the tile itself is
 * non-interactive so taps pass to the shell's tile chrome.
 */

import { useMemo } from "react"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { docHarmony } from "../../model/document"
import { KEY_NAMES, midiToX, pitchClass, type RibbonWindow } from "../../music/ribbonScales"
import { activeMidiInRange } from "../../music/resolver"

interface Props {
  store: BeatloungeStore
  color?: string
}

const TILE_WIN: RibbonWindow = { lowMidi: 48, spanSemis: 24 } // a tidy 2-octave preview

export const RibbonTile = ({ store, color }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const h = docHarmony(doc)
  const tonicPc = ((h.tonic % 12) + 12) % 12
  const label =
    h.mode === "chordal"
      ? `${h.progression.length} chords`
      : h.scale.id.split(".").pop()?.replace(/([a-z])([A-Z])/g, "$1 $2") ?? "scale"

  const frets = useMemo(() => {
    const notes = activeMidiInRange(doc, 0, TILE_WIN.lowMidi, TILE_WIN.lowMidi + TILE_WIN.spanSemis)
    return notes.map((midi) => ({
      midi,
      x: midiToX(midi, TILE_WIN),
      tonic: pitchClass(midi) === tonicPc,
    }))
  }, [doc, tonicPc])

  return (
    <div className="bl-ribbon-tile">
      <div className="bl-ribbon-tile-head">
        <span className="bl-dot" style={{ background: color }} />
        <span className="bl-ribbon-tile-title">Ribbon</span>
        <span className="bl-ribbon-tile-key">
          {KEY_NAMES[tonicPc]} {label}
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
