/**
 * useFitText — BANK-DRIVEN phrase fit. The word bank (target-language chips) is
 * the interactive part: every chip must be visible, never clipped, never
 * scrolled off. So the TOP phrase yields its space to it.
 *
 * After layout, it checks whether the bank overflows its allotted box. If it
 * fits (short / normal phrases) the phrase is left ALONE at full size. Only when
 * the bank overflows does it shrink the phrase — first pulling the line spacing +
 * padding in (no text-size loss), then, if still needed, shrinking the font down
 * to a readable floor — using just enough to make the entire bank fit.
 *
 * Re-runs on phrase change + viewport resize. Imperative inline styles, reset
 * each run so it's idempotent and a long→short navigation restores full size.
 */
import { useLayoutEffect, useRef } from "react"

const FONT_FLOOR = 14 // smallest the prompt font may go (still readable)
const TIGHT_LINE_HEIGHT = "1.05"
const TIGHT_PADDING = "7px 18px"

export function useFitText<T extends HTMLElement>(key: string | null | undefined) {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof window === "undefined") return

    const main = el.closest<HTMLElement>(".jsf-main")
    const bank = main?.querySelector<HTMLElement>(".jsf-bank") ?? null

    const fit = () => {
      // Reset to the CSS-natural size so we measure (and so short phrases that
      // navigated in after a long one go back to full size).
      el.style.fontSize = ""
      el.style.lineHeight = ""
      el.style.padding = ""
      if (!bank) return

      // Does the bank overflow its box? (scrollHeight > clientHeight ⇒ a row is
      // being cut/scrolled.) Reading these forces the needed reflow each call.
      const bankOverflows = () => bank.scrollHeight > bank.clientHeight + 2

      if (!bankOverflows()) return // whole bank already fits — leave the phrase

      // LARGE phrase. 1) Pull the leading + padding in (reclaims space, no text
      // shrink). Shrinking the phrase grows the bank's box, so re-check.
      el.style.lineHeight = TIGHT_LINE_HEIGHT
      el.style.padding = TIGHT_PADDING
      if (!bankOverflows()) return

      // 2) Still overflowing — shrink the phrase font to the LARGEST size that
      // lets the whole bank fit (binary search down to the floor).
      const maxPx = parseFloat(getComputedStyle(el).fontSize) || 28
      let lo = FONT_FLOOR
      let hi = Math.max(maxPx, FONT_FLOOR)
      let best = FONT_FLOOR
      for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2
        el.style.fontSize = `${mid}px`
        if (!bankOverflows()) {
          best = mid // fits — try larger
          lo = mid
        } else {
          hi = mid // still overflows — go smaller
        }
      }
      el.style.fontSize = `${best}px`
      // If even FONT_FLOOR can't make it fit (a true 30+ word monster), the bank
      // keeps its own overflow-y:auto as the last-resort scroll.
    }

    fit()
    // One more pass after the browser settles the first layout (fonts/chips).
    const raf = requestAnimationFrame(fit)
    window.addEventListener("resize", fit)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", fit)
    }
  }, [key])

  return ref
}
