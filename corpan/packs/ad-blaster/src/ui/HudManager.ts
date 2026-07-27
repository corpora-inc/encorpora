import type { ScoreSystem } from "../systems/ScoreSystem"

export type HudManager = {
  update: () => void
  showCombo: (points: number, combo: number) => void
  dispose: () => void
}

export const createHudManager = (root: HTMLElement, score: ScoreSystem): HudManager => {
  const hud = document.createElement("div")
  hud.className = "ab-hud"
  root.appendChild(hud)

  // Left side: score + wave
  const leftCol = document.createElement("div")
  leftCol.className = "ab-hud-left"
  hud.appendChild(leftCol)

  const scoreEl = document.createElement("div")
  scoreEl.className = "ab-hud-score"
  leftCol.appendChild(scoreEl)

  const waveEl = document.createElement("div")
  waveEl.className = "ab-hud-wave"
  leftCol.appendChild(waveEl)

  // Center: combo
  const comboEl = document.createElement("div")
  comboEl.className = "ab-hud-combo"
  hud.appendChild(comboEl)

  // Right side: lives + high score
  const rightCol = document.createElement("div")
  rightCol.className = "ab-hud-right"
  hud.appendChild(rightCol)

  const livesEl = document.createElement("div")
  livesEl.className = "ab-hud-lives"
  rightCol.appendChild(livesEl)

  const hiEl = document.createElement("div")
  hiEl.className = "ab-hud-hi"
  rightCol.appendChild(hiEl)

  // Combo popup
  const comboPopup = document.createElement("div")
  comboPopup.className = "ab-combo-popup"
  root.appendChild(comboPopup)
  let comboTimeout: ReturnType<typeof setTimeout> | null = null

  const onScoreEvent = (e: Event) => {
    const detail = (e as CustomEvent).detail as { points: number; combo: number }
    showCombo(detail.points, detail.combo)
  }
  window.addEventListener("ad-blaster-score", onScoreEvent)

  const update = () => {
    scoreEl.textContent = `SCORE ${score.getScore()}`
    waveEl.textContent = `WAVE ${score.getLevel()}`
    livesEl.textContent = "♥".repeat(Math.max(0, score.getLives()))

    const hi = score.getHighScore()
    if (hi > 0) {
      hiEl.textContent = `HI ${hi}`
      hiEl.style.opacity = "1"
    } else {
      hiEl.style.opacity = "0"
    }

    const combo = score.getCombo()
    if (combo > 1) {
      comboEl.textContent = `${combo}x COMBO`
      comboEl.style.opacity = "1"
    } else {
      comboEl.style.opacity = "0"
    }
  }

  const showCombo = (points: number, combo: number) => {
    if (combo < 2) return
    comboPopup.textContent = `+${points}`
    comboPopup.style.opacity = "1"
    comboPopup.style.transform = "translate(-50%, -50%) scale(1.2)"
    if (comboTimeout) clearTimeout(comboTimeout)
    comboTimeout = setTimeout(() => {
      comboPopup.style.opacity = "0"
      comboPopup.style.transform = "translate(-50%, -50%) scale(0.5)"
    }, 600)
  }

  const dispose = () => {
    window.removeEventListener("ad-blaster-score", onScoreEvent)
    if (comboTimeout) clearTimeout(comboTimeout)
    hud.remove()
    comboPopup.remove()
  }

  return { update, showCombo, dispose }
}
