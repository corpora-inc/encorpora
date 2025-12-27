import { createStore } from "zustand/vanilla"
import { createJSONStorage, persist } from "zustand/middleware"
import { SPEED } from "./core/constants"

// iOS detection helper for performance tuning
const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false
  return /iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)
}

export type TuningSettings = {
  // Core gameplay
  autoAdjustDifficulty: boolean
  textScaleFactor: number
  // Audio settings
  musicEnabled: boolean
  sfxEnabled: boolean
  musicVolume: number
  sfxVolume: number
  // Advanced gameplay (baseline values for auto-adjustment)
  baselineSpeed: number // Starting speed before auto-adjustment
  baselineCorrectProb: number // Starting probability of correct answer (0-1, default 0.5)
  baselineDistractors: number // Starting number of distractors (default 2)
  baselineMaxPhrases: number // Starting max simultaneous phrases (default 1)
  baselineMaxMisses: number // Starting tolerance for misses (default 1)
  // Maximum caps for auto-adjustment
  maxSpeed: number // Fastest speed allowed (default 22)
  maxDistractors: number // Most distractors allowed (default 6)
  maxSimultaneousPhrases: number // Most phrases at once (default 3)
  maxMaxMisses: number // Most misses tolerated (default 4)
  minCorrectProb: number // Hardest probability (default 0.1 = 1 in 10)
}

export type TuningRuntime = {
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
  level: number // Visual progression level (1-20)
  xp: number // Experience points for leveling up
  netCorrect: number // Total correct - total incorrect (for difficulty scaling)
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
  resetNetCorrect: () => void
}

const DEFAULT_SETTINGS: TuningSettings = {
  // Core gameplay
  autoAdjustDifficulty: true,
  textScaleFactor: 0.6,
  // Audio settings
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.3,
  sfxVolume: 0.5,
  // Advanced gameplay baselines
  baselineSpeed: 12,
  baselineCorrectProb: 0.5, // 50% correct at start (1 in 2)
  baselineDistractors: 2,
  baselineMaxPhrases: 1,
  baselineMaxMisses: 1,
  // Maximum caps
  maxSpeed: 22,
  maxDistractors: 6,
  maxSimultaneousPhrases: 3,
  maxMaxMisses: 4,
  minCorrectProb: 0.1, // 10% at hardest (1 in 10)
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

// XP progression curve: exponential scaling for 20 levels
// Level 1→2: 10 XP, Level 2→3: 15 XP, etc.
const getXpForLevel = (level: number): number => {
  if (level >= 20) return Infinity // Max level reached
  return Math.floor(10 + level * 5)
}

const MAX_LEVEL = 20

export const tuningStore = createStore<TuningState>()(
  persist(
    (set, _get) => ({
      settings: { ...DEFAULT_SETTINGS },
      runtime: { currentPhraseCount: 1 },
      stats: {
        score: 0,
        streak: 0,
        bestStreak: 0,
        allTimeBestStreak: 0,
        phraseHistory: [],
        coinCount: 0,
        level: 1,
        xp: 0,
        netCorrect: 0,
      },
      setSetting: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [key]: value,
          },
        })),
      resetRuntime: () =>
        set(() => ({
          runtime: { currentPhraseCount: 1 },
        })),
      recordCorrect: (points = 1) =>
        set((state) => {
          const nextStreak = state.stats.streak + 1
          const nextScore = state.stats.score + points
          const nextBest = Math.max(state.stats.bestStreak, nextStreak)
          const nextAllTimeBest = Math.max(state.stats.allTimeBestStreak, nextStreak)
          const nextNetCorrect = state.stats.netCorrect + 1

          // XP and leveling system
          let nextXp = state.stats.xp + points
          let nextLevel = state.stats.level
          const xpNeeded = getXpForLevel(nextLevel)

          // Level up if enough XP
          while (nextLevel < MAX_LEVEL && nextXp >= xpNeeded) {
            nextXp -= xpNeeded
            nextLevel++
          }

          // Auto-adjust difficulty if enabled
          // Phrase count increases continuously on each correct answer
          let nextPhraseCount = state.runtime.currentPhraseCount
          if (state.settings.autoAdjustDifficulty) {
            // Gradual continuous increase: +0.17 per correct answer
            // Takes ~6 correct to reach 2 phrases, ~12 correct to reach 3 phrases
            nextPhraseCount = Math.min(
              state.runtime.currentPhraseCount + 0.17,
              state.settings.maxSimultaneousPhrases
            )
          }

          return {
            stats: {
              ...state.stats,
              score: nextScore,
              streak: nextStreak,
              bestStreak: nextBest,
              allTimeBestStreak: nextAllTimeBest,
              level: nextLevel,
              xp: nextXp,
              netCorrect: nextNetCorrect,
            },
            runtime: {
              ...state.runtime,
              currentPhraseCount: nextPhraseCount,
            },
          }
        }),
      recordWrong: () =>
        set((state) => {
          const nextNetCorrect = state.stats.netCorrect - 1

          // Auto-adjust difficulty if enabled
          // Reduce phrase count gradually on failure
          let nextPhraseCount = state.runtime.currentPhraseCount
          if (state.settings.autoAdjustDifficulty) {
            // Gradual decrease: -0.25 per wrong answer (slightly more than increase)
            nextPhraseCount = Math.max(1, state.runtime.currentPhraseCount - 0.25)
          }

          return {
            stats: {
              ...state.stats,
              streak: 0,
              netCorrect: nextNetCorrect,
            },
            runtime: {
              ...state.runtime,
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
            level: state.stats.level,
            xp: state.stats.xp,
            netCorrect: state.stats.netCorrect, // Preserve difficulty progression
          },
        })),
      resetNetCorrect: () => {
        console.log("[STORE] resetNetCorrect called")
        set((state) => {
          console.log("[STORE] Setting netCorrect from", state.stats.netCorrect, "to 0")
          return {
            stats: {
              ...state.stats,
              netCorrect: 0,
            },
          }
        })
      },
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
          level: state.stats.level,
          xp: state.stats.xp,
          netCorrect: state.stats.netCorrect,
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
            level: stored?.stats?.level ?? current.stats.level,
            xp: stored?.stats?.xp ?? current.stats.xp,
            netCorrect: stored?.stats?.netCorrect ?? current.stats.netCorrect,
          },
        }
      },
    }
  )
)
