/**
 * beatlounge — the SCRATCH PLATTER: a real record the user drags. The disc rotates
 * under a FIXED NEEDLE; the needle points at ONE exact moment in the phrase (the
 * playhead) and the sound is LOCKED to that same moment. Words are placed along the
 * spiral groove at their real buffer-time positions (spiraling inward across
 * revolutions for a phrase longer than one turn), so you can see — and scrub to —
 * any word.
 *
 * The drag's angular sweep around the centre is reported to the parent, which
 * accumulates it into an UNWRAPPED rotation → a single clamped buffer playhead
 * (no wrap: past the end is run-off). Pointer-captured, but it only owns the drag
 * when the pointer starts on the platter surface (chrome carries data-bl-nocapture
 * and never overlaps the disc), so it never steals taps from controls.
 */

import { useRef } from "react"
import { pointerAngle, timeToSpiral, type WordSpan } from "./scratchMath"

interface Props {
  /** Current visual rotation in radians (driven by the parent's RAF loop). */
  rotation: number
  /** Total phrase duration (seconds) — sets the spiral's inward walk. */
  durationSec: number
  /** Word spans (seconds) placed along the groove. */
  spans: WordSpan[]
  /** Per-word labels parallel to `spans`. */
  words: string[]
  /** Index of the current word (under the needle); −1 if none. */
  currentWord: number
  /** Language tag for the word labels. */
  langTag?: string
  /** True while a finger is scratching (rim glows). */
  active: boolean
  /** Reduced-motion: the disc holds still; audio scratch still works. */
  reducedMotion: boolean
  /** A grab begins — parent zeroes its velocity tracker. */
  onGrab(): void
  /** Angular sweep since the last sample, in radians (signed, seam-unwrapped). */
  onSweep(deltaRadians: number): void
  /** The finger lifted — parent coasts the platter with momentum. */
  onRelease(): void
}

/** Inner radius floor (fraction) the spiral stops at — clears the spindle/label. */
const INNER_FLOOR = 0.2

export const Platter = ({
  rotation,
  durationSec,
  spans,
  words,
  currentWord,
  langTag,
  active,
  reducedMotion,
  onGrab,
  onSweep,
  onRelease,
}: Props) => {
  const elRef = useRef<HTMLDivElement | null>(null)
  const lastAngle = useRef<number | null>(null)
  const dragging = useRef(false)

  const centre = (): { cx: number; cy: number } | null => {
    const el = elRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button > 0) return
    const el = elRef.current
    if (!el) return
    const c = centre()
    if (!c) return
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore (tests / unsupported) */
    }
    dragging.current = true
    lastAngle.current = pointerAngle(c.cx, c.cy, e.clientX, e.clientY)
    onGrab()
    e.preventDefault()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const c = centre()
    if (!c) return
    const ang = pointerAngle(c.cx, c.cy, e.clientX, e.clientY)
    const prev = lastAngle.current
    if (prev != null) {
      let d = ang - prev
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      onSweep(d)
    }
    lastAngle.current = ang
  }

  const end = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    lastAngle.current = null
    try {
      elRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    onRelease()
  }

  const spin = reducedMotion ? 0 : rotation

  // Place each word along the spiral groove (positioned in the ROTATING frame:
  // the vinyl wrapper carries `rotation`, so a word at buffer-time t sits at its
  // spiral angle and rides under the fixed needle when the disc turns to it).
  const wordDots = spans.map((s, i) => {
    const mid = (s.start + s.end) / 2
    const sp = timeToSpiral(mid, durationSec, INNER_FLOOR)
    const r = sp.radiusFrac * 0.5 // fraction of half-width (radius) from centre
    // Spiral angle, measured from straight up (the needle sits at the top).
    const x = 50 + Math.sin(sp.angle) * r * 100
    const y = 50 - Math.cos(sp.angle) * r * 100
    return { i, x, y, text: words[i] ?? "" }
  })

  return (
    <div
      ref={elRef}
      className={`bl-scr-platter${active ? " is-active" : ""}`}
      role="slider"
      aria-label="Scratch platter — drag to scratch the phrase"
      aria-valuetext={active ? "scratching" : "ready"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      style={{ ["--bl-scr-rot" as string]: `${spin}rad` }}
    >
      <div className="bl-scr-vinyl" aria-hidden="true">
        <div className="bl-scr-grooves" />
        {wordDots.map((w) => (
          <span
            key={w.i}
            className={`bl-scr-word${w.i === currentWord ? " is-cur" : ""}`}
            lang={langTag}
            style={{
              ["--bl-scr-wx" as string]: `${w.x}%`,
              ["--bl-scr-wy" as string]: `${w.y}%`,
            }}
          >
            {w.text}
          </span>
        ))}
        <div className="bl-scr-label">
          {langTag && <span className="bl-scr-label-lang">{langTag}</span>}
          <span className="bl-scr-spindle" />
        </div>
      </div>

      {/* Fixed needle: never rotates; points at the moment under the head. */}
      <div className="bl-scr-needle" aria-hidden="true">
        <span className="bl-scr-needle-arm" />
        <span className="bl-scr-needle-tip" />
      </div>
    </div>
  )
}
