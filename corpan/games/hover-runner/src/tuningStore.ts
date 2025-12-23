import { createStore } from "zustand/vanilla"
import { createJSONStorage, persist } from "zustand/middleware"

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
}

export type TuningRuntime = {
  speedDelta: number
}

export type GameStats = {
  score: number
  streak: number
  bestStreak: number
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
  recordCorrect: () => void
  recordWrong: () => void
  recordDodge: () => void
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
  textScaleFactor: 100,
  textOverflowFactor: 3,
  speakRepeatMs: 5000,
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export const tuningStore = createStore<TuningState>()(
  persist(
    (set, get) => ({
      settings: { ...DEFAULT_SETTINGS },
      runtime: { speedDelta: 0 },
      stats: { score: 0, streak: 0, bestStreak: 0 },
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
      recordCorrect: () =>
        set((state) => {
          const nextStreak = state.stats.streak + 1
          const nextScore = state.stats.score + 1
          const nextBest = Math.max(state.stats.bestStreak, nextStreak)
          const nextSpeed = clamp(
            state.runtime.speedDelta + state.settings.speedStepUp,
            state.settings.phraseSpeedMin - state.settings.basePhraseSpeed,
            state.settings.phraseSpeedMax - state.settings.basePhraseSpeed
          )
          return {
            stats: {
              score: nextScore,
              streak: nextStreak,
              bestStreak: nextBest,
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
          return {
            stats: {
              score: nextScore,
              streak: nextStreak,
              bestStreak: nextBest,
            },
          }
        }),
      resetStats: () =>
        set(() => ({
          stats: { score: 0, streak: 0, bestStreak: 0 },
        })),
    }),
    {
      name: "hover-runner-tuning",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
      merge: (persisted, current) => {
        const stored = persisted as Partial<TuningState> | undefined
        return {
          ...current,
          ...stored,
          settings: {
            ...current.settings,
            ...(stored?.settings ?? {}),
          },
        }
      },
    }
  )
)
