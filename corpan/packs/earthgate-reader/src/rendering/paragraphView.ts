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
  let lastActiveLineOffset = -1
  let targetScrollTop = 0
  let scrollRafId: number | null = null

  // Continuous scroll easing. Every frame we glide `scrollArea.scrollTop`
  // a fraction of the way toward `targetScrollTop`, then re-request until
  // we're within half a pixel. highlightWord() updates the target on every
  // new line so reading naturally pulls the scroll along.
  function easeScroll() {
    const current = scrollArea.scrollTop
    const delta = targetScrollTop - current
    if (Math.abs(delta) < 0.5) {
      scrollArea.scrollTop = targetScrollTop
      scrollRafId = null
      return
    }
    scrollArea.scrollTop = current + delta * 0.1
    scrollRafId = requestAnimationFrame(easeScroll)
  }
  function startEasing() {
    if (scrollRafId === null) scrollRafId = requestAnimationFrame(easeScroll)
  }
  function stopEasing() {
    if (scrollRafId !== null) {
      cancelAnimationFrame(scrollRafId)
      scrollRafId = null
    }
  }

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

  // Viewport-absolute clean zone: the reading area between the top fade
  // (y=0 → safe-top+top-clearance) and the transport fade at the bottom.
  // +20px buffer so words land clearly outside each fade, not grazing them.
  function getCleanTop(): number {
    const safeTop = parseFloat(getComputedStyle(container).paddingTop) || 0
    const topClearance =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--eg-top-clearance"),
      ) || 80
    return safeTop + topClearance + 20
  }
  function getCleanBottom(): number {
    const transportClearance =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--eg-transport-clearance"),
      ) || 130
    return window.innerHeight - transportClearance - 20
  }

  return {
    setSegment(_seg: BookSegment, manifestSeg: ManifestSegment | undefined) {
      activeIndex = -1
      wordSpans = []
      lastActiveLineOffset = -1
      targetScrollTop = 0
      stopEasing()
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

      // Reset conditional classes from previous segment, scroll to top.
      inner.classList.remove("earthgate-paragraph-inner--pad-top")
      inner.classList.remove("earthgate-paragraph-inner--pad-bottom-extra")
      scrollArea.scrollTop = 0

      // After layout:
      //  1. If the first word would render inside the top fade band, pad
      //     the inner so it starts below the fade.
      //  2. If the last word would render near/past the bottom fade band,
      //     add extra trailing space. This turns medium segments (which
      //     would otherwise fit without overflow but bleed into the fade)
      //     into smoothly-scrolling content, and gives long segments the
      //     overshoot they need to keep the last line at the reading
      //     target instead of drifting to the bottom.
      requestAnimationFrame(() => {
        if (wordSpans.length === 0) return
        const fadeBottom = getCleanTop()
        const firstRect = wordSpans[0].getBoundingClientRect()
        if (firstRect.top < fadeBottom) {
          inner.classList.add("earthgate-paragraph-inner--pad-top")
          scrollArea.scrollTop = 0
        }
        const cleanBottom = getCleanBottom()
        const lastRect = wordSpans[wordSpans.length - 1].getBoundingClientRect()
        if (lastRect.bottom > cleanBottom - 20) {
          inner.classList.add("earthgate-paragraph-inner--pad-bottom-extra")
        }
      })
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
        const span = wordSpans[index]
        span.classList.add("earthgate-word--active")

        // Continuous easing scroll. On every new line we recompute the
        // target scrollTop that would place the active word at the reading
        // anchor (just past midline of the clean area); the rAF easing
        // loop glides toward it over several frames. Word-by-word the
        // target shifts by one line-height, so the scroll drifts smoothly
        // under the text without ever snapping. Clamped to the scroll
        // container's range so the word naturally sits higher before
        // scroll catches up and lower at the end of a segment once the
        // scroll maxes out. The 0.6 anchor (vs. a 0.5 midline) still
        // keeps the recently-read text visible above the active word,
        // without burying the active line so far down that you lose
        // sight of what's coming next.
        if (span.offsetTop !== lastActiveLineOffset) {
          lastActiveLineOffset = span.offsetTop
          const cleanTop = getCleanTop()
          const cleanBottom = getCleanBottom()
          const anchor = cleanTop + (cleanBottom - cleanTop) * 0.6
          const spanRect = span.getBoundingClientRect()
          const wordCenter = spanRect.top + spanRect.height / 2
          const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight
          const proposed = scrollArea.scrollTop + (wordCenter - anchor)
          targetScrollTop = Math.max(0, Math.min(maxScroll, proposed))
          startEasing()
        }
      }
    },

    onNext(cb: () => void) { nextCb = cb },
    onPrev(cb: () => void) { prevCb = cb },
    onTap(cb: () => void) { tapCb = cb },

    dispose() {
      stopEasing()
      container.remove()
    },
  }
}
