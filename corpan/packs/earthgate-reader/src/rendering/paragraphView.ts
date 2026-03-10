import type { BookSegment, ManifestSegment } from "@shared/core"

export type ParagraphView = {
  setSegment: (seg: BookSegment, manifestSeg: ManifestSegment | undefined) => void
  highlightWord: (index: number) => void
  onNext: (cb: () => void) => void
  onPrev: (cb: () => void) => void
  dispose: () => void
}

const SWIPE_THRESHOLD = 50

/**
 * Create a paragraph view that renders book segment text with
 * per-word highlighting synced to audio playback.
 */
export function createParagraphView(parent: HTMLElement): ParagraphView {
  let nextCb: (() => void) | null = null
  let prevCb: (() => void) | null = null
  let activeIndex = -1
  let wordSpans: HTMLSpanElement[] = []
  let lastScrollCheck = 0

  const container = document.createElement("div")
  container.className = "earthgate-paragraph"
  parent.appendChild(container)

  const inner = document.createElement("div")
  inner.className = "earthgate-paragraph-inner"
  container.appendChild(inner)

  // --- Swipe detection ---
  let pointerStartX = 0
  let pointerStartY = 0
  let pointerId: number | null = null

  container.addEventListener("pointerdown", (e) => {
    pointerId = e.pointerId
    pointerStartX = e.clientX
    pointerStartY = e.clientY
  })

  container.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointerId) return
    // Allow vertical scroll, only intercept clear horizontal swipes
  })

  container.addEventListener("pointerup", (e) => {
    if (e.pointerId !== pointerId) return
    const dx = e.clientX - pointerStartX
    const dy = e.clientY - pointerStartY
    pointerId = null

    // Only trigger if horizontal displacement exceeds threshold
    // and is more horizontal than vertical
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) {
        nextCb?.()
      } else {
        prevCb?.()
      }
    }
  })

  container.addEventListener("pointercancel", () => {
    pointerId = null
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
      container.scrollTop = 0
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
          const containerRect = container.getBoundingClientRect()
          const spanRect = span.getBoundingClientRect()
          if (spanRect.bottom > containerRect.bottom - 40 || spanRect.top < containerRect.top + 40) {
            span.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        }
      }
    },

    onNext(cb: () => void) { nextCb = cb },
    onPrev(cb: () => void) { prevCb = cb },

    dispose() {
      container.remove()
    },
  }
}
