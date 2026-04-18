import type { BookSegment, ManifestSegment } from "@shared/core"

export type ParagraphView = {
  setSegment: (seg: BookSegment, manifestSeg: ManifestSegment | undefined) => void
  highlightWord: (index: number) => void
  onNext: (cb: () => void) => void
  onPrev: (cb: () => void) => void
  onTap: (cb: () => void) => void
  dispose: () => void
}

const SWIPE_THRESHOLD = 50

/**
 * Create a paragraph view that renders book segment text with
 * per-word highlighting synced to audio playback.
 *
 * Two separate interaction regions:
 * - Text column (`.earthgate-paragraph-inner`) → click = tap-to-replay.
 * - Swipe bands above/below the text → pointer drag = prev/next segment.
 *
 * The bands are plain flex items, not inside any scroll container, so
 * pointer events fire predictably on them regardless of where the pointer
 * lands within the band's area.
 */
export function createParagraphView(parent: HTMLElement): ParagraphView {
  let nextCb: (() => void) | null = null
  let prevCb: (() => void) | null = null
  let tapCb: (() => void) | null = null
  let activeIndex = -1
  let wordSpans: HTMLSpanElement[] = []
  let lastScrollCheck = 0

  const container = document.createElement("div")
  container.className = "earthgate-paragraph"
  parent.appendChild(container)

  const bandTop = document.createElement("div")
  bandTop.className = "earthgate-swipe-band"
  bandTop.dataset.band = "top"
  container.appendChild(bandTop)

  const scrollArea = document.createElement("div")
  scrollArea.className = "earthgate-paragraph-scroll"
  container.appendChild(scrollArea)

  const inner = document.createElement("div")
  inner.className = "earthgate-paragraph-inner"
  inner.dir = "auto"
  scrollArea.appendChild(inner)

  const bandBottom = document.createElement("div")
  bandBottom.className = "earthgate-swipe-band"
  bandBottom.dataset.band = "bottom"
  container.appendChild(bandBottom)

  function attachSwipe(band: HTMLElement) {
    let pointerId: number | null = null
    let startX = 0
    let startY = 0

    band.addEventListener("pointerdown", (e) => {
      pointerId = e.pointerId
      startX = e.clientX
      startY = e.clientY
      try { band.setPointerCapture(e.pointerId) } catch { /* older browsers */ }
    })

    band.addEventListener("pointerup", (e) => {
      if (e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      pointerId = null

      if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) nextCb?.()
        else prevCb?.()
      }
    })

    band.addEventListener("pointercancel", (e) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
    })
  }

  attachSwipe(bandTop)
  attachSwipe(bandBottom)

  // Tap on text column. `click` only fires when no scroll/drag happened,
  // so no manual movement threshold is needed.
  inner.addEventListener("click", () => {
    tapCb?.()
  })

  return {
    setSegment(_seg: BookSegment, manifestSeg: ManifestSegment | undefined) {
      activeIndex = -1
      wordSpans = []
      inner.innerHTML = ""

      if (!manifestSeg || manifestSeg.words.length === 0) return

      // Render from manifest words — these are the actual spoken words
      // with 1:1 index alignment to the timeline's wordIndex
      for (let i = 0; i < manifestSeg.words.length; i++) {
        if (i > 0) {
          inner.appendChild(document.createTextNode(" "))
        }
        const span = document.createElement("span")
        span.className = "earthgate-word"
        span.textContent = manifestSeg.words[i].word
        inner.appendChild(span)
        wordSpans.push(span)
      }

      // Scroll to top for new segment
      scrollArea.scrollTop = 0
    },

    highlightWord(index: number) {
      if (index === activeIndex) return

      // Remove previous highlight
      if (activeIndex >= 0 && activeIndex < wordSpans.length) {
        wordSpans[activeIndex].classList.remove("earthgate-word--active")
      }

      activeIndex = index

      // Add new highlight
      if (index >= 0 && index < wordSpans.length) {
        wordSpans[index].classList.add("earthgate-word--active")

        // Throttled scroll check — avoid layout thrash on every word
        const now = performance.now()
        if (now - lastScrollCheck > 300) {
          lastScrollCheck = now
          const span = wordSpans[index]
          const scrollRect = scrollArea.getBoundingClientRect()
          const spanRect = span.getBoundingClientRect()
          if (spanRect.bottom > scrollRect.bottom - 40 || spanRect.top < scrollRect.top + 40) {
            span.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        }
      }
    },

    onNext(cb: () => void) { nextCb = cb },
    onPrev(cb: () => void) { prevCb = cb },
    onTap(cb: () => void) { tapCb = cb },

    dispose() {
      container.remove()
    },
  }
}
