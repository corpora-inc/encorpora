/**
 * Juice Glass Animation Module
 * Creates an SVG juice glass that fills as player completes phrases,
 * with an orange squeeze animation on each win.
 */

export type JuiceGlass = {
  updateFill: (level: number) => void
  triggerSqueeze: () => void
  dispose: () => void
}

export const createJuiceGlass = (root: HTMLElement): JuiceGlass => {
  const container = document.createElement("div")
  container.className = "juice-glass-container"
  container.innerHTML = `
    <div class="orange-squeeze">
      <div class="orange"></div>
      <div class="juice-stream"></div>
    </div>
    <svg class="juice-glass" viewBox="0 0 100 150" preserveAspectRatio="xMidYMid meet">
      <!-- Glass outline -->
      <path class="glass-outline" d="M20,15 L15,130 Q15,145 30,145 L70,145 Q85,145 85,130 L80,15 Z"
            fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
      <!-- Juice fill (clipped to glass shape) -->
      <defs>
        <clipPath id="glass-clip">
          <path d="M21,16 L16,129 Q16,144 31,144 L69,144 Q84,144 84,129 L79,16 Z"/>
        </clipPath>
        <linearGradient id="juice-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#FFD54F"/>
          <stop offset="50%" style="stop-color:#FFB84D"/>
          <stop offset="100%" style="stop-color:#FF9800"/>
        </linearGradient>
      </defs>
      <rect class="juice-fill" x="15" y="145" width="70" height="0"
            clip-path="url(#glass-clip)" fill="url(#juice-gradient)"/>
      <!-- Glass highlight -->
      <path class="glass-highlight" d="M28,20 L25,120"
            stroke="rgba(255,255,255,0.4)" stroke-width="4" stroke-linecap="round"/>
      <!-- Glass rim -->
      <ellipse cx="50" cy="15" rx="32" ry="6"
               fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
    </svg>
  `
  root.appendChild(container)

  const juiceFill = container.querySelector(".juice-fill") as SVGRectElement
  const orangeSqueeze = container.querySelector(".orange-squeeze") as HTMLElement

  return {
    updateFill: (level: number) => {
      const clampedLevel = Math.max(0, Math.min(1, level))
      const maxFillHeight = 128 // Glass inner height
      const fillHeight = maxFillHeight * clampedLevel
      const fillY = 145 - fillHeight
      juiceFill.setAttribute("height", String(fillHeight))
      juiceFill.setAttribute("y", String(fillY))
    },
    triggerSqueeze: () => {
      orangeSqueeze.classList.add("squeezing")
      setTimeout(() => {
        orangeSqueeze.classList.remove("squeezing")
      }, 1500)
    },
    dispose: () => {
      container.remove()
    },
  }
}
