export type ChapterOverlay = {
  show: (title: string) => void
  dispose: () => void
}

/**
 * Create a chapter title overlay that appears at the top of the screen,
 * holds briefly, then fades out.
 */
export function createChapterOverlay(parent: HTMLElement): ChapterOverlay {
  let fadeTimer: ReturnType<typeof setTimeout> | null = null
  let holdTimer: ReturnType<typeof setTimeout> | null = null

  const el = document.createElement("div")
  el.className = "earthgate-chapter-overlay"
  el.style.opacity = "0"
  parent.appendChild(el)

  function clearTimers() {
    if (holdTimer !== null) { clearTimeout(holdTimer); holdTimer = null }
    if (fadeTimer !== null) { clearTimeout(fadeTimer); fadeTimer = null }
  }

  return {
    show(title: string) {
      clearTimers()

      el.textContent = title

      // Force reflow so transition restarts if already visible
      el.style.transition = "none"
      el.style.opacity = "0"
      void el.offsetHeight

      // Fade in (0.5s)
      el.style.transition = "opacity 0.5s ease"
      el.style.opacity = "1"

      // After hold (4s), fade out (3s)
      holdTimer = setTimeout(() => {
        el.style.transition = "opacity 3s ease"
        el.style.opacity = "0"
        holdTimer = null
      }, 4000)
    },

    dispose() {
      clearTimers()
      el.remove()
    },
  }
}
