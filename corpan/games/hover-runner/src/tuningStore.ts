import { createStore } from "zustand/vanilla"
import { createJSONStorage, persist } from "zustand/middleware"

// iOS detection helper for performance tuning
const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false
  return /iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)
}

export type TuningSettings = {
  basePhraseSpeed: number
  phraseSpeedMin: number
  phraseSpeedMax: number
  speedStepUp: number
  speedStepDown: number
  respawnDelay: number
  promptLeadMs: number
  introHoldMs: number
  introRepeatMs: number
  celebrationMs: number
  postCelebrateMs: number
  maxDistractors: number
  maxIncorrectStreak: number
  correctWeight: number
  textScaleFactor: number
  textOverflowFactor: number
  speakRepeatMs: number
  // Audio settings
  musicEnabled: boolean
  sfxEnabled: boolean
  musicVolume: number
  sfxVolume: number
  // Multi-phrase settings
  maxSimultaneousPhrases: number
}

export type TuningRuntime = {
  speedDelta: number
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
  phraseSpeedMin: 8,
  phraseSpeedMax: 22,
  speedStepUp: 0.25,
  speedStepDown: 0.2,
  respawnDelay: 0.45,
  promptLeadMs: 650,
  introHoldMs: 1300,
  introRepeatMs: 700,
  celebrationMs: 900,
  postCelebrateMs: 900,
  maxDistractors: 4,
  maxIncorrectStreak: 2,
  correctWeight: 2.4,
  textScaleFactor: 0.6,
  textOverflowFactor: 3,
  // iOS performance: longer interval to reduce TTS overhead (8s vs 5s)
  speakRepeatMs: isIOS() ? 8000 : 5000,
  // Audio defaults
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.3,
  sfxVolume: 0.5,
  // Multi-phrase defaults
  maxSimultaneousPhrases: 1,
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export const tuningStore = createStore<TuningState>()(
  persist(
    (set, _get) => ({
      settings: { ...DEFAULT_SETTINGS },
      runtime: { speedDelta: 0 },
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
          runtime: { ...state.runtime, speedDelta: 0 },
        })),
      recordCorrect: (points = 1) =>
        set((state) => {
          const nextStreak = state.stats.streak + 1
          const nextScore = state.stats.score + points
          const nextBest = Math.max(state.stats.bestStreak, nextStreak)
          const nextAllTimeBest = Math.max(state.stats.allTimeBestStreak, nextStreak)
          const nextSpeed = clamp(
            state.runtime.speedDelta + state.settings.speedStepUp,
            state.settings.phraseSpeedMin - state.settings.basePhraseSpeed,
            state.settings.phraseSpeedMax - state.settings.basePhraseSpeed
          )
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
            },
          }
        }),
      recordWrong: () =>
        set((state) => {
          const nextSpeed = clamp(
            state.runtime.speedDelta - state.settings.speedStepDown,
            state.settings.phraseSpeedMin - state.settings.basePhraseSpeed,
            state.settings.phraseSpeedMax - state.settings.basePhraseSpeed
          )
          return {
            stats: {
              ...state.stats,
              streak: 0,
            },
            runtime: {
              ...state.runtime,
              speedDelta: nextSpeed,
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
