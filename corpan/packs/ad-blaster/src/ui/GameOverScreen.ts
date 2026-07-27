import type { ScoreSystem } from "../systems/ScoreSystem"
import type { AdManagerApi } from "../ad/types"

export type GameOverScreen = {
  show: (onRestart: () => void) => void
  hide: () => void
  dispose: () => void
}

export const createGameOverScreen = (
  root: HTMLElement,
  score: ScoreSystem,
  adManager: AdManagerApi
): GameOverScreen => {
  const overlay = document.createElement("div")
  overlay.className = "ab-gameover"
  root.appendChild(overlay)
  overlay.style.display = "none"

  const show = async (onRestart: () => void) => {
    // Fire interstitial ad on death FIRST
    try {
      await adManager.showInterstitial()
    } catch {
      // Ad failed, continue
    }

    overlay.innerHTML = ""
    overlay.style.display = "flex"

    const title = document.createElement("h1")
    title.className = "ab-gameover-title"
    title.textContent = "GAME OVER"
    overlay.appendChild(title)

    // New high score?
    if (score.isNewHighScore()) {
      const hiLabel = document.createElement("div")
      hiLabel.className = "ab-gameover-hi"
      hiLabel.textContent = "NEW HIGH SCORE!"
      overlay.appendChild(hiLabel)
    }

    const stats = document.createElement("div")
    stats.className = "ab-gameover-stats"
    stats.innerHTML = `
      <div>SCORE: ${score.getScore()}</div>
      <div>WAVE: ${score.getLevel()}</div>
      <div>MAX COMBO: ${score.getMaxCombo()}x</div>
      <div>ADS BLASTED: ${score.getTotalKills()}</div>
    `
    overlay.appendChild(stats)

    // Watch ad to continue
    if (adManager.isReady("rewarded")) {
      const continueBtn = document.createElement("button")
      continueBtn.className = "ab-gameover-btn ab-gameover-continue"
      continueBtn.textContent = "WATCH AD TO CONTINUE"
      continueBtn.addEventListener("click", async () => {
        continueBtn.disabled = true
        continueBtn.textContent = "LOADING AD..."
        const result = await adManager.showRewarded()
        if (result.rewarded) {
          score.grantLife()
          hide()
          onRestart()
        } else {
          continueBtn.textContent = "AD UNAVAILABLE"
          setTimeout(() => {
            continueBtn.textContent = "WATCH AD TO CONTINUE"
            continueBtn.disabled = false
          }, 2000)
        }
      })
      overlay.appendChild(continueBtn)
    }

    const restartBtn = document.createElement("button")
    restartBtn.className = "ab-gameover-btn"
    restartBtn.textContent = "PLAY AGAIN"
    restartBtn.addEventListener("click", () => {
      hide()
      onRestart()
    })
    overlay.appendChild(restartBtn)
  }

  const hide = () => {
    overlay.style.display = "none"
  }

  const dispose = () => {
    overlay.remove()
  }

  return { show, hide, dispose }
}
