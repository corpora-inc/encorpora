/**
 * useBlockSizing — measures the play container's width (ref + ResizeObserver)
 * and computes a SHARED, readable font for the phrase (by word count). Returns a
 * `sizeFor(word)` that yields only `{ fontSize }`; chips are CONTENT-sized in CSS
 * (padding in `em`) so the same shared font drives BOTH the bank and the
 * sentence and text is never clipped. Only a giant single word shrinks further
 * so it still fits on one line (see fontForWord).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { sharedFontSize, fontForWord } from "../blockSizing"

export type BlockSize = { fontSize: number }

export function useBlockSizing(words: string[]) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Observe the container width (recompute on resize / rotation / keyboard).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setContainerWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // One shared font for the whole phrase; recompute on phrase/width change.
  const sharedFont = useMemo(() => sharedFontSize(words), [words])
  const maxChipWidthPx = useMemo(() => containerWidth * 0.8, [containerWidth])

  const sizeFor = useCallback(
    (word: string): BlockSize => ({
      fontSize: fontForWord(word, sharedFont, maxChipWidthPx),
    }),
    [sharedFont, maxChipWidthPx]
  )

  return { containerRef, sizeFor }
}
