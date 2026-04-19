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
const TAP_MOVEMENT_THRESHOLD = 8

/**
 * Paragraph view with unified gesture handling:
 *
 * - Swipe anywhere in the paragraph area (including directly over the words)
 *   navigates to prev/next segment.
 * - Tap inside the text column triggers the tap callback (play-one preview).
 *
 * Both are detected from a single `pointerdown`/`pointerup` pair on the
 * container. Tap is inferred from near-zero movement rather than relying on
 * synthesized `click` — that avoids the "need two taps after a modal
 * dismisses" bug where browsers sometimes swallow the first synthetic click.
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

  const scrollArea = document.createElement("div")
  scrollArea.className = "earthgate-paragraph-scroll"
  container.appendChild(scrollArea)

  const inner = document.createElement("div")
  inner.className = "earthgate-paragraph-inner"
  inner.dir = "auto"
  scrollArea.appendChild(inner)

  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let startTarget: Node | null = null

  container.addEventListener("pointerdown", (e) => {
    pointerId = e.pointerId
    startX = e.clientX
    startY = e.clientY
    startTarget = e.target as Node | null
    try { container.setPointerCapture(e.pointerId) } catch { /* older browsers */ }
  })

  container.addEventListener("pointerup", (e) => {
    if (e.pointerId !== pointerId) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    const origin = startTarget
    pointerId = null
    startTarget = null

    // Swipe: horizontal-dominant past threshold, regardless of origin.
    if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) nextCb?.()
      else prevCb?.()
      return
    }

    // Tap: minimal movement AND interaction began inside the text column.
    if (
      Math.abs(dx) <= TAP_MOVEMENT_THRESHOLD &&
      Math.abs(dy) <= TAP_MOVEMENT_THRESHOLD &&
      origin !== null &&
      inner.contains(origin)
    ) {
      tapCb?.()
    }
  })

  container.addEventListener("pointercancel", (e) => {
    if (e.pointerId !== pointerId) return
    pointerId = null
    startTarget = null
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
