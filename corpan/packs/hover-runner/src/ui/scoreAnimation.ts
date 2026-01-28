/**
 * Juicy +N score animation that appears when points are earned
 */

type ScorePopup = {
  element: HTMLDivElement
  startTime: number
  points: number
}

const activePopups: ScorePopup[] = []
let animationFrameId: number | null = null

export const createScoreAnimator = (container: HTMLElement) => {
  const animate = (currentTime: number) => {
    const toRemove: ScorePopup[] = []

    activePopups.forEach((popup) => {
      const elapsed = currentTime - popup.startTime
      const duration = 1500 // 1.5 seconds

      if (elapsed >= duration) {
        toRemove.push(popup)
        popup.element.remove()
        return
      }

      // Animation phases
      const progress = elapsed / duration

      // Phase 1: Pop in (0-0.15) - scale and bounce
      if (progress < 0.15) {
        const popProgress = progress / 0.15
        const scale = 0.5 + popProgress * 0.7 // 0.5 -> 1.2
        const bounce = Math.sin(popProgress * Math.PI) * 0.1
        popup.element.style.transform = `translate(-50%, -50%) scale(${scale + bounce})`
        popup.element.style.opacity = `${Math.min(1, popProgress * 3)}`
      }
      // Phase 2: Stabilize (0.15-0.3) - settle to 1.0
      else if (progress < 0.3) {
        const settleProgress = (progress - 0.15) / 0.15
        const scale = 1.2 - settleProgress * 0.2 // 1.2 -> 1.0
        popup.element.style.transform = `translate(-50%, -50%) scale(${scale})`
        popup.element.style.opacity = "1"
      }
      // Phase 3: Float and fade (0.3-1.0) - rise and disappear
      else {
        const floatProgress = (progress - 0.3) / 0.7
        const yOffset = floatProgress * 60 // Float up 60px
        const scale = 1.0 + floatProgress * 0.3 // Grow slightly
        const opacity = 1 - Math.pow(floatProgress, 1.5) // Fade out with easing

        popup.element.style.transform = `translate(-50%, calc(-50% - ${yOffset}px)) scale(${scale})`
        popup.element.style.opacity = `${opacity}`
      }
    })

    // Remove completed popups
    toRemove.forEach((popup) => {
      const index = activePopups.indexOf(popup)
      if (index > -1) {
        activePopups.splice(index, 1)
      }
    })

    // Continue animation if there are active popups
    if (activePopups.length > 0) {
      animationFrameId = requestAnimationFrame(animate)
    } else {
      animationFrameId = null
    }
  }

  const showScorePopup = (points: number) => {
    const popup = document.createElement("div")
    popup.className = "score-popup"
    popup.textContent = `+${points}`

    // Random horizontal offset for variety
    const randomOffset = (Math.random() - 0.5) * 40
    popup.style.left = `calc(50% + ${randomOffset}px)`

    container.appendChild(popup)

    const popupData: ScorePopup = {
      element: popup,
      startTime: performance.now(),
      points,
    }

    activePopups.push(popupData)

    // Start animation loop if not already running
    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(animate)
    }
  }

  const cleanup = () => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    activePopups.forEach((popup) => popup.element.remove())
    activePopups.length = 0
  }

  return { showScorePopup, cleanup }
}
