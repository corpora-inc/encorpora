/**
 * beatlounge — the SCRATCH PLATTER: a big circular record the user drags to
 * scratch. The drag's angular sweep around the centre is reported to the parent,
 * which maps the sweep DIRECTLY to a buffer position (1:1, no lag) and feeds back
 * the live rotation so the disc visibly tracks the finger — the label, grooves
 * and spindle all turn with it. The CURRENT WORD is printed on the rotating
 * label so you can see which word you are scrubbing.
 *
 * Pointer-captured, but it ONLY owns the drag when the pointer starts on the
 * platter surface itself — chrome carries `data-bl-nocapture` and never overlaps
 * the disc — so it never steals taps from controls (playbook). The whole disc is
 * the grab target; the centre spindle stays clear of the rim controls.
 */

import { useRef } from "react"
import { pointerAngle } from "./scratchMath"

interface Props {
  /** Current visual rotation in radians (driven by the parent's RAF loop). */
  rotation: number
  /** The CURRENT word being scrubbed, shown on the rotating label. */
  word: string
  /** Language tag under the word. */
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

export const Platter = ({
  rotation,
  word,
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
    // Only own the drag when it starts on the platter surface (never under chrome).
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
      // Unwrap the −π/π seam so a sweep across the back of the disc stays smooth.
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
        <div className="bl-scr-label">
          <span className="bl-scr-label-text" lang={langTag}>
            {word || "—"}
          </span>
          {langTag && <span className="bl-scr-label-lang">{langTag}</span>}
          <span className="bl-scr-spindle" />
        </div>
        <div className="bl-scr-marker" />
      </div>
    </div>
  )
}
