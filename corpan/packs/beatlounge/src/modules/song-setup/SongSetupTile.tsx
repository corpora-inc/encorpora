/**
 * beatlounge — Song Setup TILE: a compact, glanceable summary of the piece.
 * One line — "16 beats · 4/4 · 96bpm" (or the tala name) — over a tiny
 * accent-dotted cycle preview. Tapping enters the full setup. Read-only.
 */

import { useMemo } from "react"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { Glyph } from "../../bl-ui"
import {
  CYCLE_CATALOG,
  formatMeter,
  summarize,
  ticksToBeats,
  type Cycle,
} from "./songMath"
import type { TimeSignature } from "../../model/timing"

interface Props {
  store: BeatloungeStore
  /** Last-loaded cycle id, surfaced by the module so the tile can name it. */
  cycleId?: string
}

const defaultSig: TimeSignature = { numerator: 4, denominator: 4 }

/** Match a doc state back to a catalog cycle by meter + beat count (best-effort). */
const matchCycle = (
  beats: number,
  sig: TimeSignature,
  cycleId?: string
): Cycle | undefined => {
  if (cycleId) {
    const named = CYCLE_CATALOG.find((c) => c.id === cycleId)
    if (named && named.beats === beats && formatMeter(named.sig) === formatMeter(sig)) {
      return named
    }
  }
  return CYCLE_CATALOG.find(
    (c) => c.beats === beats && formatMeter(c.sig) === formatMeter(sig)
  )
}

export const SongSetupTile = ({ store, cycleId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const sig = doc.meterMap[0]?.sig ?? defaultSig
  const beats = ticksToBeats(doc.loopLengthTicks, sig)
  const cycle = useMemo(() => matchCycle(beats, sig, cycleId), [beats, sig, cycleId])

  const accents = useMemo(() => {
    const set = new Set(cycle?.accents ?? [0])
    return Array.from({ length: Math.min(beats, 32) }, (_, i) => set.has(i))
  }, [cycle, beats])

  return (
    <div className="bl-tile-grid">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="metronome" size={16} />
        </span>
        <span className="bl-tile-title">Rhythmic Cycle</span>
        <span className="bl-tile-meta">{formatMeter(sig)}</span>
      </div>

      <div className="bl-song-tilesummary">
        {summarize({ loopTicks: doc.loopLengthTicks, sig, bpm: doc.bpm, cycleName: cycle?.name })}
      </div>

      <div className="bl-song-tilecycle" aria-hidden="true">
        {accents.map((on, i) => (
          <span key={i} className={"bl-song-beat" + (on ? " is-accent" : "")} />
        ))}
        {beats > 32 && <span className="bl-song-beat-more">+{beats - 32}</span>}
      </div>
    </div>
  )
}
