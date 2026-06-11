/**
 * beatlounge — the PLAYABLE multitouch instrument surface. A continuous-pitch
 * "string field": X = pitch (left→right), stacked octave rows. Each finger
 * opens a live voice on the bound track's instrument and glides its pitch as it
 * drags (fretless / Theremin). Polyphonic via Pointer Events with per-pointer
 * capture; many fingers = many voices.
 *
 * Three modes (a compact switch above): Fretless (continuous, no markers),
 * Chromatic (continuous + semitone reference lines), Scale (snapped to the
 * song's scale via the `quantizeToScale` SEAM — the harmony engine wires it
 * later; chromatic identity until then).
 *
 * Pure pitch↔position math lives in ./pitchMap; this file owns only the DOM,
 * the pointer bookkeeping, and the live-voice plumbing. Tokens-only styling.
 */

import { useCallback, useMemo, useRef, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { LiveVoiceHandle } from "../../contracts/audioFacade"
import type { Id } from "../../model/document"
import {
  DEFAULT_RANGE,
  midiToNoteName,
  positionToMidi,
  resolvePitch,
  rowMarkers,
  type PlayMode,
  type QuantizeToScale,
  type SurfaceRange,
} from "./pitchMap"

export interface PlaySurfaceProps {
  host: BeatloungeHost
  trackId: Id
  range?: SurfaceRange
  /** HARMONY SEAM (integrator wires these to the global Harmony engine).
   *  When present + mode is "scale", continuous pitch snaps via `quantizeToScale`. */
  quantizeToScale?: QuantizeToScale
  /** Scale pitch CLASSES (0..11) for in-scale marker highlighting. */
  scalePitches?: readonly number[]
}

/** One live finger on the surface. */
interface Touch {
  handle: LiveVoiceHandle | undefined
  midi: number
  nx: number
  ny: number
}

const MODES: PlayMode[] = ["fretless", "chromatic", "scale"]
const MODE_LABEL: Record<PlayMode, string> = {
  fretless: "Fretless",
  chromatic: "Chromatic",
  scale: "Scale",
}

export const PlaySurface = ({
  host,
  trackId,
  range = DEFAULT_RANGE,
  quantizeToScale,
  scalePitches,
}: PlaySurfaceProps) => {
  const [mode, setMode] = useState<PlayMode>("chromatic")
  const surfRef = useRef<HTMLDivElement | null>(null)
  const rectRef = useRef<DOMRect | null>(null)
  const touches = useRef<Map<number, Touch>>(new Map())
  // Live "active dots" for visual feedback (re-rendered on touch change).
  const [dots, setDots] = useState<{ id: number; nx: number; ny: number }[]>([])

  // Mode is read live inside pointer handlers via a ref (handlers aren't rebound).
  const modeRef = useRef(mode)
  modeRef.current = mode
  const quantRef = useRef(quantizeToScale)
  quantRef.current = quantizeToScale

  const rows = Math.max(1, Math.floor(range.rows))

  const norm = useCallback((clientX: number, clientY: number) => {
    const r = rectRef.current
    if (!r || r.width <= 0 || r.height <= 0) return { nx: 0, ny: 0 }
    return {
      nx: (clientX - r.left) / r.width,
      ny: (clientY - r.top) / r.height,
    }
  }, [])

  const syncDots = useCallback(() => {
    const next: { id: number; nx: number; ny: number }[] = []
    for (const [id, t] of touches.current) next.push({ id, nx: t.nx, ny: t.ny })
    setDots(next)
  }, [])

  const pitchAt = useCallback(
    (nx: number, ny: number): number =>
      resolvePitch(positionToMidi(nx, ny, range), modeRef.current, quantRef.current),
    [range]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Bail for chrome (the mode chips live in their own row, but be safe).
      if ((e.target as Element)?.closest?.("[data-bl-nocapture]")) return
      const el = surfRef.current
      if (!el) return
      rectRef.current = el.getBoundingClientRect()
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* capture may be unavailable — proceed */
      }
      const { nx, ny } = norm(e.clientX, e.clientY)
      const midi = pitchAt(nx, ny)
      const handle = host.playLiveVoice(trackId, midi, 0.9)
      touches.current.set(e.pointerId, { handle, midi, nx, ny })
      syncDots()
      e.preventDefault()
    },
    [host, trackId, norm, pitchAt, syncDots]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const t = touches.current.get(e.pointerId)
      if (!t) return
      const { nx, ny } = norm(e.clientX, e.clientY)
      const midi = pitchAt(nx, ny)
      t.nx = nx
      t.ny = ny
      // Only bend when the resolved pitch actually moved (scale mode quantizes,
      // so many micro-moves resolve to the same note → no needless work).
      if (midi !== t.midi) {
        t.midi = midi
        t.handle?.bend(midi)
      }
      syncDots()
    },
    [norm, pitchAt, syncDots]
  )

  const endPointer = useCallback(
    (e: React.PointerEvent) => {
      const t = touches.current.get(e.pointerId)
      if (!t) return
      t.handle?.release()
      touches.current.delete(e.pointerId)
      try {
        surfRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      syncDots()
    },
    [syncDots]
  )

  // Marker rows (chromatic + scale only). Lowest row at the BOTTOM.
  const markerRows = useMemo(() => {
    if (mode === "fretless") return []
    const out: { rowIndex: number; markers: ReturnType<typeof rowMarkers> }[] = []
    for (let r = 0; r < rows; r++) {
      const rowBase = range.baseMidi + r * range.rowSpanSemis
      out.push({
        rowIndex: r,
        markers: rowMarkers(
          rowBase,
          range.rowSpanSemis,
          mode === "scale" ? scalePitches : undefined
        ),
      })
    }
    return out
  }, [mode, rows, range, scalePitches])

  const liveNote = dots.length
    ? midiToNoteName(touches.current.get(dots[dots.length - 1].id)?.midi ?? 0)
    : ""

  return (
    <div className="bl-play">
      <div className="bl-play-modes" role="tablist" aria-label="Play mode" data-bl-nocapture>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={m === mode}
            className={`bl-chip${m === mode ? " is-on" : ""}`}
            onClick={() => setMode(m)}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
        <span className="bl-play-note" aria-live="polite">{liveNote}</span>
      </div>

      <div
        ref={surfRef}
        className={`bl-play-surface is-${mode}`}
        role="application"
        aria-label="Instrument surface. Touch and drag to play; pitch glides continuously."
        aria-roledescription="multitouch instrument"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
      >
        {/* Row dividers + chromatic/scale markers (bottom row = lowest). */}
        {markerRows.map(({ rowIndex, markers }) => {
          const topPct = ((rows - 1 - rowIndex) / rows) * 100
          const heightPct = 100 / rows
          return (
            <div
              key={rowIndex}
              className="bl-play-row"
              style={{ top: `${topPct}%`, height: `${heightPct}%` }}
              aria-hidden="true"
            >
              {markers.map((mk) => (
                <span
                  key={mk.midi}
                  className={
                    "bl-play-marker" +
                    (mk.octave ? " is-octave" : "") +
                    (mk.inScale ? " is-in" : " is-out")
                  }
                  style={{ left: `${mk.nx * 100}%` }}
                />
              ))}
            </div>
          )
        })}

        {/* Live finger glow dots. */}
        {dots.map((d) => (
          <span
            key={d.id}
            className="bl-play-dot"
            style={{ left: `${d.nx * 100}%`, top: `${d.ny * 100}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  )
}
