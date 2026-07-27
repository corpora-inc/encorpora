import type { StackConfig } from "../sdk/types"

export type GameStore<T> = {
  getState: () => T
  update: (updater: (draft: T) => void) => void
  subscribe: (listener: (state: T) => void) => () => void
}

export type InputSnapshot = {
  targetX: number
  targetY: number
  hasTarget: boolean
  tapOnAd: boolean
  tapAdId: string | null
}

export type GameFrameState = {
  stackConfig: StackConfig | null
  score: number
  lives: number
  level: number
  combo: number
  maxCombo: number
  totalKills: number
  gameOver: boolean
  paused: boolean
  activeMode: string | null
}

export type SettingsState = {
  sfxEnabled: boolean
  musicEnabled: boolean
  highScore: number
  totalGamesPlayed: number
  totalAdsBlasted: number
}

export type InitialState = {
  stackConfig?: StackConfig
}

export type EnemyDef = {
  type: string
  hp: number
  speed: number
  size: number
  points: number
  color: string
  steer?: number
  adCreativeId?: string
}
