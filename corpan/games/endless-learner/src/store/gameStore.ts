import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type GameSettings = {
  musicVolume: number
  sfxVolume: number
  baseSpeed: number
  adaptiveSpeed: boolean
  correctChance: number
  maxCandidates: number
  showPrompt: boolean
  showRomanization: boolean
  showFeedback: boolean
  showHints: boolean
}

export type GameStats = {
  score: number
  streak: number
}

type GameStoreState = {
  settings: GameSettings
  stats: GameStats
  setSettings: (settings: GameSettings) => void
  updateSettings: (partial: Partial<GameSettings>) => void
  resetSettings: () => void
  setScore: (score: number) => void
  setStreak: (streak: number) => void
  incrementScore: (delta: number) => void
  incrementStreak: (delta?: number) => void
  resetStreak: () => void
}

export const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.7,
  sfxVolume: 0.07,
  baseSpeed: 1,
  adaptiveSpeed: true,
  correctChance: 0.35,
  maxCandidates: 1,
  showPrompt: true,
  showRomanization: true,
  showFeedback: true,
  showHints: true,
}

const DEFAULT_STATS: GameStats = {
  score: 0,
  streak: 0,
}

export const useGameStore = create<GameStoreState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      stats: DEFAULT_STATS,
      setSettings: (settings) => set({ settings }),
      updateSettings: (partial) =>
        set((state) => ({ settings: { ...state.settings, ...partial } })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
      setScore: (score) => set((state) => ({ stats: { ...state.stats, score } })),
      setStreak: (streak) =>
        set((state) => ({ stats: { ...state.stats, streak } })),
      incrementScore: (delta) =>
        set((state) => ({
          stats: { ...state.stats, score: state.stats.score + delta },
        })),
      incrementStreak: (delta = 1) =>
        set((state) => ({
          stats: { ...state.stats, streak: state.stats.streak + delta },
        })),
      resetStreak: () =>
        set((state) => ({ stats: { ...state.stats, streak: 0 } })),
    }),
    {
      name: "endless-learner-store",
      version: 1,
      storage: createJSONStorage(() => {
        try {
          return window.localStorage
        } catch {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          }
        }
      }),
      partialize: (state) => ({
        settings: state.settings,
        stats: state.stats,
      }),
      merge: (persisted, current) => {
        const data = persisted as Partial<GameStoreState> | undefined
        return {
          ...current,
          settings: { ...current.settings, ...(data?.settings ?? {}) },
          stats: { ...current.stats, ...(data?.stats ?? {}) },
        }
      },
    }
  )
)
