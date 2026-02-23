export type TransportBar = {
  setPlaying: (playing: boolean) => void
  setChapter: (title: string) => void
  setTime: (currentMs: number, totalMs: number) => void
  setLanguages: (languages: string[], current: string) => void
  onPlay: (cb: () => void) => void
  onPause: (cb: () => void) => void
  onPrevChapter: (cb: () => void) => void
  onNextChapter: (cb: () => void) => void
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
 * Create the bottom transport bar with play/pause, chapter skip, and language selector.
 *
 * Layout:
 *   Top row:  [chapter title]              [elapsed / total]
 *   Bottom:   [|◀]  [▶/❚❚]  [▶|]  [EN ▾]
 */
export function createTransportBar(parent: HTMLElement): TransportBar {
  let playing = false
  let playCb: (() => void) | null = null
  let pauseCb: (() => void) | null = null
  let prevCb: (() => void) | null = null
  let nextCb: (() => void) | null = null
  let langCb: ((lang: string) => void) | null = null

  // --- Container ---
  const bar = document.createElement("div")
  bar.className = "stargate-transport"

  // --- Top row ---
  const topRow = document.createElement("div")
  topRow.className = "stargate-transport-top"
  bar.appendChild(topRow)

  const chapterLabel = document.createElement("div")
  chapterLabel.className = "stargate-chapter"
  chapterLabel.textContent = "Loading\u2026"
  topRow.appendChild(chapterLabel)

  const timeLabel = document.createElement("div")
  timeLabel.className = "stargate-time"
  timeLabel.textContent = "0:00 / 0:00"
  topRow.appendChild(timeLabel)

  // --- Bottom row (controls) ---
  const controls = document.createElement("div")
  controls.className = "stargate-transport-controls"
  bar.appendChild(controls)

  // Prev chapter
  const prevBtn = document.createElement("button")
  prevBtn.className = "stargate-transport-btn"
  prevBtn.textContent = "\u23EE"
  prevBtn.title = "Previous chapter"
  prevBtn.addEventListener("click", () => prevCb?.())
  controls.appendChild(prevBtn)

  // Play / Pause
  const playBtn = document.createElement("button")
  playBtn.className = "stargate-transport-btn stargate-play-btn"
  playBtn.textContent = "\u25B6"
  playBtn.title = "Play / Pause"
  playBtn.addEventListener("click", () => {
    if (playing) {
      pauseCb?.()
    } else {
      playCb?.()
    }
  })
  controls.appendChild(playBtn)

  // Next chapter
  const nextBtn = document.createElement("button")
  nextBtn.className = "stargate-transport-btn"
  nextBtn.textContent = "\u23ED"
  nextBtn.title = "Next chapter"
  nextBtn.addEventListener("click", () => nextCb?.())
  controls.appendChild(nextBtn)

  // Language selector
  const langSelect = document.createElement("select")
  langSelect.className = "stargate-lang-select"
  langSelect.title = "Language"
  langSelect.addEventListener("change", () => {
    langCb?.(langSelect.value)
  })
  controls.appendChild(langSelect)

  parent.appendChild(bar)

  return {
    setPlaying(state: boolean) {
      playing = state
      playBtn.textContent = state ? "\u275A\u275A" : "\u25B6"
    },

    setChapter(title: string) {
      chapterLabel.textContent = title
    },

    setTime(currentMs: number, totalMs: number) {
      timeLabel.textContent = `${formatTime(currentMs)} / ${formatTime(totalMs)}`
    },

    setLanguages(languages: string[], current: string) {
      langSelect.innerHTML = ""
      for (const lang of languages) {
        const opt = document.createElement("option")
        opt.value = lang
        opt.textContent = lang.toUpperCase()
        if (lang === current) opt.selected = true
        langSelect.appendChild(opt)
      }
      // Hide when only 1 language
      langSelect.style.display = languages.length <= 1 ? "none" : ""
    },

    onPlay(cb: () => void) { playCb = cb },
    onPause(cb: () => void) { pauseCb = cb },
    onPrevChapter(cb: () => void) { prevCb = cb },
    onNextChapter(cb: () => void) { nextCb = cb },
    onLanguageChange(cb: (lang: string) => void) { langCb = cb },

    dispose() {
      bar.remove()
    },
  }
}
