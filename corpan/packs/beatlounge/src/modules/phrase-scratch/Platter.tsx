/**
 * beatlounge — the SCRATCH PLATTER: a real record the user drags. The disc rotates
 * under a FIXED NEEDLE at 3 o'clock (the RIGHT); the needle points at ONE exact
 * moment in the phrase (the playhead) and the sound is LOCKED to that same moment.
 * Words are placed along the spiral groove at their real buffer-time positions
 * (spiraling inward across revolutions; the phrase loops), so the word UNDER the
 * needle is exactly the word you hear.
 *
 * NEEDLE / DIRECTION CONVENTION
 *   The disc's accumulated `rotation` is clockwise-positive (a forward, clockwise
 *   drag plays forward). CSS `rotate(rotation)` turns the vinyl clockwise. The
 *   current playhead time `t` has spiral angle `θ = t / SECONDS_PER_RAD` which EQUALS
 *   `rotation` (mod 2π). So we place each word at LOCAL screen angle `−θ` (measured
 *   from the needle's 3 o'clock direction); after the disc rotates by `rotation`, the
 *   current word lands at screen angle `−θ + rotation = 0` = under the right-side
 *   needle. (The old build placed the needle at the TOP and used `sin θ / −cos θ`,
 *   which put the label ~180° from the audio — fixed here.)
 *
 * The drag's angular sweep around the centre is reported to the parent, which
 * accumulates it into an UNWRAPPED rotation → a single LOOPED buffer playhead.
 * Pointer-captured, but it only owns the drag when the pointer starts on the platter
 * surface (chrome carries data-bl-nocapture and never overlaps the disc), so it
 * never steals taps from controls.
 */

import { useRef, type MutableRefObject } from "react"
import { pointerAngle, timeToSpiral, type WordSpan } from "./scratchMath"
import { ct } from "../../i18n/strings"

interface Props {
  /**
   * The parent's RAF loop owns the live rotation: it writes the `--bl-scr-rot`
   * CSS var straight onto THIS element every frame via `rootRef`, so the disc
   * spins at 60fps without ever re-rendering React (the per-frame render was the
   * scratch view's GC/jank source). React state only changes on rate/word ticks.
   */
  rootRef?: MutableRefObject<HTMLDivElement | null>
  /** REAL phrase duration (seconds) — sets the spiral's inward walk for word labels. */
  phraseSec: number
  /** Word spans (seconds) placed along the groove. */
  spans: WordSpan[]
  /** Per-word labels parallel to `spans`. */
  words: string[]
  /** Index of the current word (under the needle); −1 if none. */
  currentWord: number
  /** The playhead is in the padded SILENT round (no audio) — fade the word +
   *  START indicators so they don't imply sound that isn't there (#421). */
  silent?: boolean
  /** Language tag for the word labels. */
  langTag?: string
  /** True while a finger is scratching (rim glows). */
  active: boolean
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
  rootRef,
  phraseSec,
  spans,
  words,
  currentWord,
  silent = false,
  langTag,
  active,
  onGrab,
  onSweep,
  onRelease,
}: Props) => {
  const elRef = useRef<HTMLDivElement | null>(null)
  const lastAngle = useRef<number | null>(null)
  const dragging = useRef(false)

  // Merge our measurement ref with the parent's rotation-driving ref.
  const setRoot = (el: HTMLDivElement | null) => {
    elRef.current = el
    if (rootRef) rootRef.current = el
  }

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

  // Place each word along the spiral groove in the disc's LOCAL frame. The needle is
  // fixed at 3 o'clock (screen angle 0, the +x / east direction). A word at spiral
  // angle θ sits at local screen angle −θ from the needle, so when the vinyl rotates
  // CW by `rotation`, the current word (θ == rotation) lands exactly under the needle.
  const wordDots = spans.map((s, i) => {
    // Anchor the label at the word's START (when its highlight begins), so the
    // active word sits UNDER the needle as it lights up — not a quarter-turn
    // behind (which is what anchoring at the mid/end produced).
    const sp = timeToSpiral(s.start, phraseSec, INNER_FLOOR)
    const r = sp.radiusFrac * 0.5 // fraction of half-width (radius) from centre
    const a = -sp.angle // local screen angle from the 3 o'clock needle
    const x = 50 + Math.cos(a) * r * 100
    const y = 50 + Math.sin(a) * r * 100
    return { i, x, y, text: words[i] ?? "" }
  })

  // The START marker: a single tasteful tick fixed on the disc at the start-of-phrase
  // groove point (spiral angle 0, outer rim → local screen angle 0). It rides the
  // rotating vinyl; because the loop is rev-quantized, this point returns under the
  // fixed 3 o'clock needle at the SAME angle every loop. The reference for the loop.
  const startX = 50 + Math.cos(0) * (1 * 0.5) * 100 // outer rim, +x
  const startY = 50

  return (
    <div
      ref={setRoot}
      className={`bl-scr-platter${active ? " is-active" : ""}`}
      role="slider"
      aria-label={ct("scratch.platter")}
      aria-valuetext={active ? ct("scratch.scratching") : ct("scratch.ready")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="bl-scr-vinyl" aria-hidden="true">
        <div className="bl-scr-grooves" />
        {/* The single START marker — fixed on the disc at the phrase start (t=0). */}
        <span
          className={`bl-scr-start${silent ? " is-silent" : ""}`}
          style={{
            ["--bl-scr-sx" as string]: `${startX}%`,
            ["--bl-scr-sy" as string]: `${startY}%`,
          }}
        />
        {wordDots.map((w) => (
          <span
            key={w.i}
            className={`bl-scr-word${w.i === currentWord ? " is-cur" : ""}${silent ? " is-silent" : ""}`}
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

      {/* Fixed needle at 3 o'clock: never rotates; points at the moment under it. */}
      <div className="bl-scr-needle" aria-hidden="true">
        <span className="bl-scr-needle-arm" />
        <span className="bl-scr-needle-tip" />
      </div>
    </div>
  )
}
