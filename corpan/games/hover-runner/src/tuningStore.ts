import { createStore } from "zustand/vanilla"
import { createJSONStorage, persist } from "zustand/middleware"
import { SPEED } from "./core/constants"

// iOS detection helper for performance tuning
const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false
  return /iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)
}

export type TuningSettings = {
  // User-adjustable gameplay settings
  basePhraseSpeed: number
  autoAdjustDifficulty: boolean
  textScaleFactor: number
  maxDistractors: number
  maxIncorrectStreak: number
  correctWeight: number
  // Audio settings
  musicEnabled: boolean
  sfxEnabled: boolean
  musicVolume: number
  sfxVolume: number
  // Chaos mode
  maxSimultaneousPhrases: number
}

export type TuningRuntime = {
  speedDelta: number
  currentPhraseCount: number
}

export type PhraseHistoryEntry = {
  id: string
  sourceLang: string
  targetLang: string
  correct: boolean
  timestamp: number
}

export type GameStats = {
  score: number
  streak: number
  bestStreak: number
  allTimeBestStreak: number
  phraseHistory: PhraseHistoryEntry[]
  coinCount: number
}

export type TuningState = {
  settings: TuningSettings
  runtime: TuningRuntime
  stats: GameStats
  setSetting: <K extends keyof TuningSettings>(
    key: K,
    value: TuningSettings[K]
  ) => void
  resetRuntime: () => void
  recordCorrect: (points?: number) => void
  recordWrong: () => void
  recordDodge: () => void
  recordPhraseResult: (
    id: string,
    sourceLang: string,
    targetLang: string,
    correct: boolean
  ) => void
  addCoins: (count: number) => void
  removeCoins: (count: number) => void
  resetStats: () => void
}

const DEFAULT_SETTINGS: TuningSettings = {
  basePhraseSpeed: 14,
  autoAdjustDifficulty: true,
  textScaleFactor: 0.6,
  maxDistractors: 4,
  maxIncorrectStreak: 2,
  correctWeight: 2.4,
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.3,
  sfxVolume: 0.5,
  maxSimultaneousPhrases: 3,
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export const tuningStore = createStore<TuningState>()(
  persist(
    (set, _get) => ({
      settings: { ...DEFAULT_SETTINGS },
      runtime: { speedDelta: 0, currentPhraseCount: 1 },
      stats: {
        score: 0,
        streak: 0,
        bestStreak: 0,
        allTimeBestStreak: 0,
        phraseHistory: [],
        coinCount: 0,
      },
      setSetting: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [key]: value,
          },
        })),
      resetRuntime: () =>
        set((state) => ({
          runtime: { speedDelta: 0, currentPhraseCount: 1 },
        })),
      recordCorrect: (points = 1) =>
        set((state) => {
          const nextStreak = state.stats.streak + 1
          const nextScore = state.stats.score + points
          const nextBest = Math.max(state.stats.bestStreak, nextStreak)
          const nextAllTimeBest = Math.max(state.stats.allTimeBestStreak, nextStreak)

          // Auto-adjust difficulty if enabled
          let nextSpeed = state.runtime.speedDelta
          let nextPhraseCount = state.runtime.currentPhraseCount

          if (state.settings.autoAdjustDifficulty) {
            // Increase speed slightly on success
            nextSpeed = clamp(
              state.runtime.speedDelta + SPEED.stepUp,
              SPEED.min - state.settings.basePhraseSpeed,
              SPEED.max - state.settings.basePhraseSpeed
            )

            // Gradually increase phrase count based on streak
            // Every 3 correct in a row, add a phrase (up to max)
            if (nextStreak % 3 === 0 && nextStreak > 0) {
              nextPhraseCount = Math.min(
                state.runtime.currentPhraseCount + 1,
                state.settings.maxSimultaneousPhrases
              )
            }
          }

          return {
            stats: {
              ...state.stats,
              score: nextScore,
              streak: nextStreak,
              bestStreak: nextBest,
              allTimeBestStreak: nextAllTimeBest,
            },
            runtime: {
              ...state.runtime,
              speedDelta: nextSpeed,
              currentPhraseCount: nextPhraseCount,
            },
          }
        }),
      recordWrong: () =>
        set((state) => {
          // Auto-adjust difficulty if enabled
          let nextSpeed = state.runtime.speedDelta
          let nextPhraseCount = state.runtime.currentPhraseCount

          if (state.settings.autoAdjustDifficulty) {
            // Decrease speed on failure
            nextSpeed = clamp(
              state.runtime.speedDelta - SPEED.stepDown,
              SPEED.min - state.settings.basePhraseSpeed,
              SPEED.max - state.settings.basePhraseSpeed
            )

            // Reduce phrase count back to 1 on failure
            nextPhraseCount = 1
          }

          return {
            stats: {
              ...state.stats,
              streak: 0,
            },
            runtime: {
              ...state.runtime,
              speedDelta: nextSpeed,
              currentPhraseCount: nextPhraseCount,
            },
          }
        }),
      recordDodge: () =>
        set((state) => {
          const nextStreak = state.stats.streak + 1
          const nextScore = state.stats.score + 1
          const nextBest = Math.max(state.stats.bestStreak, nextStreak)
          const nextAllTimeBest = Math.max(state.stats.allTimeBestStreak, nextStreak)
          return {
            stats: {
              ...state.stats,
              score: nextScore,
              streak: nextStreak,
              bestStreak: nextBest,
              allTimeBestStreak: nextAllTimeBest,
            },
          }
        }),
      recordPhraseResult: (id, sourceLang, targetLang, correct) =>
        set((state) => {
          const entry: PhraseHistoryEntry = {
            id,
            sourceLang,
            targetLang,
            correct,
            timestamp: Date.now(),
          }
          const MAX_HISTORY = 1000
          const nextHistory = [...state.stats.phraseHistory, entry]
          // Keep only the most recent MAX_HISTORY entries (FIFO)
          const trimmedHistory =
            nextHistory.length > MAX_HISTORY
              ? nextHistory.slice(nextHistory.length - MAX_HISTORY)
              : nextHistory
          return {
            stats: {
              ...state.stats,
              phraseHistory: trimmedHistory,
            },
          }
        }),
      addCoins: (count) =>
        set((state) => ({
          stats: {
            ...state.stats,
            coinCount: state.stats.coinCount + count,
          },
        })),
      removeCoins: (count) =>
        set((state) => ({
          stats: {
            ...state.stats,
            coinCount: Math.max(0, state.stats.coinCount - count),
          },
        })),
      resetStats: () =>
        set((state) => ({
          stats: {
            score: 0,
            streak: 0,
            bestStreak: 0,
            allTimeBestStreak: state.stats.allTimeBestStreak,
            phraseHistory: state.stats.phraseHistory,
            coinCount: state.stats.coinCount,
          },
        })),
    }),
    {
      name: "hover-runner-tuning",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        stats: {
          score: state.stats.score,
          streak: state.stats.streak,
          bestStreak: state.stats.bestStreak,
          allTimeBestStreak: state.stats.allTimeBestStreak,
          phraseHistory: state.stats.phraseHistory,
          coinCount: state.stats.coinCount,
        },
      }),
      merge: (persisted, current) => {
        const stored = persisted as Partial<TuningState> | undefined
        return {
          ...current,
          ...stored,
          settings: {
            ...current.settings,
            ...(stored?.settings ?? {}),
          },
          stats: {
            ...current.stats,
            score: stored?.stats?.score ?? current.stats.score,
            streak: stored?.stats?.streak ?? current.stats.streak,
            bestStreak: stored?.stats?.bestStreak ?? current.stats.bestStreak,
            allTimeBestStreak:
              stored?.stats?.allTimeBestStreak ?? current.stats.allTimeBestStreak,
            phraseHistory: stored?.stats?.phraseHistory ?? current.stats.phraseHistory,
            coinCount: stored?.stats?.coinCount ?? current.stats.coinCount,
          },
        }
      },
    }
  )
)
