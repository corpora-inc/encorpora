import {
  POINTS_PER_KILL,
  COMBO_MULTIPLIER,
  COMBO_TIMEOUT,
  EXTRA_LIFE_THRESHOLD,
  STARTING_LIVES,
  MAX_LIVES,
  LEVEL_CLEAR_BONUS,
} from "../core/constants"
import { settingsStore } from "../core/settingsStore"

export type ScoreSystem = {
  getScore: () => number
  getLives: () => number
  getLevel: () => number
  getCombo: () => number
  getMaxCombo: () => number
  getTotalKills: () => number
  getHighScore: () => number
  isGameOver: () => boolean
  isNewHighScore: () => boolean
  addKill: () => number
  loseLife: () => boolean
  grantLife: () => void
  nextLevel: () => void
  updateCombo: (dt: number) => void
  reset: () => void
}

export const createScoreSystem = (): ScoreSystem => {
  let score = 0
  let lives = STARTING_LIVES
  let level = 1
  let combo = 0
  let maxCombo = 0
  let totalKills = 0
  let comboTimer = 0
  let gameOver = false
  let nextLifeAt = EXTRA_LIFE_THRESHOLD

  const addKill = (): number => {
    combo++
    comboTimer = COMBO_TIMEOUT
    if (combo > maxCombo) maxCombo = combo
    totalKills++

    const points = Math.floor(POINTS_PER_KILL * (1 + combo * COMBO_MULTIPLIER))
    score += points

    if (score >= nextLifeAt && lives < MAX_LIVES) {
      lives++
      nextLifeAt += EXTRA_LIFE_THRESHOLD
    }

    return points
  }

  const loseLife = (): boolean => {
    lives--
    combo = 0
    if (lives <= 0) {
      gameOver = true
      const settings = settingsStore.getState()
      if (score > settings.highScore) {
        settingsStore.setState({ highScore: score })
      }
      settingsStore.setState({
        totalGamesPlayed: settings.totalGamesPlayed + 1,
        totalAdsBlasted: settings.totalAdsBlasted + totalKills,
      })
      return true
    }
    return false
  }

  const grantLife = () => {
    if (lives < MAX_LIVES) {
      lives++
    }
    gameOver = false
  }

  const nextLevel = () => {
    level++
    score += LEVEL_CLEAR_BONUS
  }

  const updateCombo = (dt: number) => {
    if (combo > 0) {
      comboTimer -= dt
      if (comboTimer <= 0) {
        combo = 0
      }
    }
  }

  const reset = () => {
    score = 0
    lives = STARTING_LIVES
    level = 1
    combo = 0
    maxCombo = 0
    totalKills = 0
    comboTimer = 0
    gameOver = false
    nextLifeAt = EXTRA_LIFE_THRESHOLD
  }

  return {
    getScore: () => score,
    getLives: () => lives,
    getLevel: () => level,
    getCombo: () => combo,
    getMaxCombo: () => maxCombo,
    getTotalKills: () => totalKills,
    getHighScore: () => settingsStore.getState().highScore,
    isGameOver: () => gameOver,
    isNewHighScore: () => score > 0 && score >= settingsStore.getState().highScore,
    addKill,
    loseLife,
    grantLife,
    nextLevel,
    updateCombo,
    reset,
  }
}
