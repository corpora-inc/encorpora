import { LANGUAGE_NAMES } from "../core/constants"

export type TransportBar = {
  setPlaying: (playing: boolean) => void
  setChapter: (title: string) => void
  setTime: (currentMs: number, totalMs: number) => void
  setProgress: (fraction: number) => void
  setChapterMarkers: (fractions: number[]) => void
  setLanguages: (langs: string[], current: string) => void
  onPlay: (cb: () => void) => void
  onPause: (cb: () => void) => void
  onPrevChapter: (cb: () => void) => void
  onNextChapter: (cb: () => void) => void
  onSkipBack: (cb: () => void) => void
  onSkipForward: (cb: () => void) => void
  onScrubStart: (cb: () => void) => void
  onScrubMove: (cb: (fraction: number) => void) => void
  onScrubEnd: (cb: (fraction: number) => void) => void
  onLanguageChange: (cb: (lang: string) => void) => void
  dispose: () => void
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

/**
 * Create the bottom transport bar with play/pause, chapter skip,
 * ±30s skip, scrub bar, and language toggle.
 */
export function createTransportBar(parent: HTMLElement): TransportBar {
  let playing = false
  let playCb: (() => void) | null = null
  let pauseCb: (() => void) | null = null
  let prevCb: (() => void) | null = null
  let nextCb: (() => void) | null = null
  let skipBackCb: (() => void) | null = null
  let skipForwardCb: (() => void) | null = null
  let scrubStartCb: (() => void) | null = null
  let scrubMoveCb: ((fraction: number) => void) | null = null
  let scrubEndCb: ((fraction: number) => void) | null = null
  let langChangeCb: ((lang: string) => void) | null = null

  // Language state
  let languages: string[] = []
  let currentLang = "en"

  // Scrub state
  let isDragging = false

  // --- Container ---
  const bar = document.createElement("div")
  bar.className = "earthgate-transport"

  // --- Language toggle button (top-right, absolute) ---
  const langBtn = document.createElement("button")
  langBtn.className = "earthgate-lang-btn"
  langBtn.textContent = "EN"
  langBtn.title = "Switch language"
  langBtn.addEventListener("click", () => {
    if (languages.length < 2) return
    const idx = languages.indexOf(currentLang)
    const nextIdx = (idx + 1) % languages.length
    langChangeCb?.(languages[nextIdx])
  })
  parent.appendChild(langBtn)

  // --- Top row ---
  const topRow = document.createElement("div")
  topRow.className = "earthgate-transport-top"
  bar.appendChild(topRow)

  const chapterLabel = document.createElement("div")
  chapterLabel.className = "earthgate-chapter"
  chapterLabel.textContent = "Loading\u2026"
  topRow.appendChild(chapterLabel)

  const timeLabel = document.createElement("div")
  timeLabel.className = "earthgate-time"
  timeLabel.textContent = "0:00 / 0:00"
  topRow.appendChild(timeLabel)

  // --- Scrub bar ---
  const scrub = document.createElement("div")
  scrub.className = "earthgate-scrub"
  bar.appendChild(scrub)

  const scrubTrack = document.createElement("div")
  scrubTrack.className = "earthgate-scrub-track"
  scrub.appendChild(scrubTrack)

  const scrubFill = document.createElement("div")
  scrubFill.className = "earthgate-scrub-fill"
  scrubTrack.appendChild(scrubFill)

  const scrubChapters = document.createElement("div")
  scrubChapters.className = "earthgate-scrub-chapters"
  scrubTrack.appendChild(scrubChapters)

  const scrubThumb = document.createElement("div")
  scrubThumb.className = "earthgate-scrub-thumb"
  scrub.appendChild(scrubThumb)

  function fractionFromPointer(e: PointerEvent): number {
    const rect = scrubTrack.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  function updateScrubVisual(fraction: number) {
    const pct = (fraction * 100).toFixed(2) + "%"
    scrubFill.style.width = pct
    scrubThumb.style.left = pct
  }

  scrub.addEventListener("pointerdown", (e) => {
    isDragging = true
    scrub.setPointerCapture(e.pointerId)
    scrubStartCb?.()
    const f = fractionFromPointer(e)
    updateScrubVisual(f)
    scrubMoveCb?.(f)
    scrubThumb.classList.add("earthgate-scrub-thumb--active")
  })

  scrub.addEventListener("pointermove", (e) => {
    if (!isDragging) return
    const f = fractionFromPointer(e)
    updateScrubVisual(f)
    scrubMoveCb?.(f)
  })

  scrub.addEventListener("pointerup", (e) => {
    if (!isDragging) return
    isDragging = false
    scrub.releasePointerCapture(e.pointerId)
    const f = fractionFromPointer(e)
    scrubEndCb?.(f)
    scrubThumb.classList.remove("earthgate-scrub-thumb--active")
  })

  scrub.addEventListener("pointercancel", (e) => {
    if (!isDragging) return
    isDragging = false
    scrub.releasePointerCapture(e.pointerId)
    const f = fractionFromPointer(e)
    scrubEndCb?.(f)
    scrubThumb.classList.remove("earthgate-scrub-thumb--active")
  })

  // --- Bottom row (controls) ---
  const controls = document.createElement("div")
  controls.className = "earthgate-transport-controls"
  bar.appendChild(controls)

  // Prev chapter
  const prevBtn = document.createElement("button")
  prevBtn.className = "earthgate-transport-btn"
  prevBtn.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" style="display:block"><rect x="3" y="5" width="3" height="14"/><polygon points="21,5 9,12 21,19"/></svg>'
  prevBtn.title = "Previous chapter"
  prevBtn.addEventListener("click", () => prevCb?.())
  controls.appendChild(prevBtn)

  // Skip back 30s
  const skipBackBtn = document.createElement("button")
  skipBackBtn.className = "earthgate-transport-btn earthgate-skip-btn"
  skipBackBtn.textContent = "\u221230"
  skipBackBtn.title = "Back 30 seconds"
  skipBackBtn.addEventListener("click", () => skipBackCb?.())
  controls.appendChild(skipBackBtn)

  // Play / Pause
  const playBtn = document.createElement("button")
  playBtn.className = "earthgate-transport-btn earthgate-play-btn"
  playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" style="display:block"><polygon points="6,4 20,12 6,20"/></svg>'
  playBtn.title = "Play / Pause"
  playBtn.addEventListener("click", () => {
    if (playing) {
      pauseCb?.()
    } else {
      playCb?.()
    }
  })
  controls.appendChild(playBtn)

  // Skip forward 30s
  const skipForwardBtn = document.createElement("button")
  skipForwardBtn.className = "earthgate-transport-btn earthgate-skip-btn"
  skipForwardBtn.textContent = "+30"
  skipForwardBtn.title = "Forward 30 seconds"
  skipForwardBtn.addEventListener("click", () => skipForwardCb?.())
  controls.appendChild(skipForwardBtn)

  // Next chapter
  const nextBtn = document.createElement("button")
  nextBtn.className = "earthgate-transport-btn"
  nextBtn.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" style="display:block"><polygon points="3,5 15,12 3,19"/><rect x="18" y="5" width="3" height="14"/></svg>'
  nextBtn.title = "Next chapter"
  nextBtn.addEventListener("click", () => nextCb?.())
  controls.appendChild(nextBtn)

  parent.appendChild(bar)

  return {
    setPlaying(state: boolean) {
      playing = state
      playBtn.innerHTML = state
        ? '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" style="display:block"><rect x="5" y="4" width="4" height="16"/><rect x="15" y="4" width="4" height="16"/></svg>'
        : '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" style="display:block"><polygon points="6,4 20,12 6,20"/></svg>'
    },

    setChapter(title: string) {
      chapterLabel.textContent = title
    },

    setTime(currentMs: number, totalMs: number) {
      timeLabel.textContent = `${formatTime(currentMs)} / ${formatTime(totalMs)}`
    },

    setProgress(fraction: number) {
      if (isDragging) return
      updateScrubVisual(fraction)
    },

    setChapterMarkers(fractions: number[]) {
      scrubChapters.innerHTML = ""
      for (const f of fractions) {
        const marker = document.createElement("div")
        marker.className = "earthgate-scrub-marker"
        marker.style.left = (f * 100).toFixed(2) + "%"
        scrubChapters.appendChild(marker)
      }
    },

    setLanguages(langs: string[], current: string) {
      languages = langs
      currentLang = current
      const name = LANGUAGE_NAMES[current] || current.toUpperCase()
      langBtn.textContent = name
      langBtn.style.display = langs.length > 1 ? "" : "none"
    },

    onPlay(cb: () => void) { playCb = cb },
    onPause(cb: () => void) { pauseCb = cb },
    onPrevChapter(cb: () => void) { prevCb = cb },
    onNextChapter(cb: () => void) { nextCb = cb },
    onSkipBack(cb: () => void) { skipBackCb = cb },
    onSkipForward(cb: () => void) { skipForwardCb = cb },
    onScrubStart(cb: () => void) { scrubStartCb = cb },
    onScrubMove(cb: (fraction: number) => void) { scrubMoveCb = cb },
    onScrubEnd(cb: (fraction: number) => void) { scrubEndCb = cb },
    onLanguageChange(cb: (lang: string) => void) { langChangeCb = cb },

    dispose() {
      bar.remove()
      langBtn.remove()
    },
  }
}
