/**
 * Game store for Juice Squeeze — Zustand.
 *
 * The PHRASE-SCOPED round slice (phrase/blocks/correctWords/bankOrder/
 * sentenceRows/hasWon + loadPhrase, the move/reorder transitions, checkWin,
 * getSentenceWords, setWon) MOVED to cap-squeeze (capability-modules.md §4.2):
 * `createRoundSlice` from @shared/capabilities/squeeze is the ONE
 * implementation of those transitions; this store composes it under the same
 * persisted shell, so the public API (and the persist key/partialize shape —
 * existing users' collections survive) is unchanged.
 *
 * Meta-progression stays HERE: score / settings / bottle-progress / level
 * bookkeeping, coins, baskets. Persist localStorage key:
 * "juice-squeeze-game-state" (UNCHANGED from shipped).
 */

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import {
  createRoundSlice,
  emptyPhrase,
  emptyRoundFields,
  type RoundState,
} from "@shared/capabilities/squeeze/src/roundStore"
import { LEVEL_FRUIT_COLORS, BOTTLES_PER_LEVEL, type CEFRLevel } from "./fruits"

// Round-model types re-exported so existing pack call sites keep their import
// path (the implementation lives in the capability now).
export type {
  PhraseMeta,
  BlockState,
  PhraseInput,
} from "@shared/capabilities/squeeze/src/roundStore"

// Completed phrase data for review feature
export type CompletedPhrase = {
  id: string
  targetText: string
  blockText: string
  targetLang: string
  blockLang: string
  completedAt: number // timestamp
}

// Collected bottle data
export type CollectedBottle = {
  id: string
  level: CEFRLevel
  color: string
  gradient?: [string, string, string] // Store full gradient for accurate color display
  completedAt: number // timestamp
  phrases: CompletedPhrase[] // Phrases completed in this bottle
}

// Bottle progress tracking
export type BottleProgress = {
  currentLevel: CEFRLevel
  phrasesInCurrentBottle: number // 0-10, resets when bottle completes
  bottlesCompletedThisLevel: number
  bottleCollection: CollectedBottle[]
  currentColorIndex: number // Index into color cycle for visual variety (0-5)
  currentBottlePhrases: CompletedPhrase[] // Phrases in current (incomplete) bottle
}

// Jars per basket: 6 collected jars → the basket is carried off + mints 1 coin.
export const BASKET_SIZE = 6

// Game statistics
export type GameStats = {
  score: number // Session score (resets)
  allTimeScore: number // Persistent all-time score
  coins: number // Persistent gold coins (1 per carried basket)
  completedPhrases: number // Session completed phrases (resets)
  allTimeCompletedPhrases: number // Persistent completed phrases count
  currentStreak: number
  bestStreak: number
  totalPhrases: number
  completedPhraseIds: string[] // All completed phrase IDs for analytics
}

// Game settings
export type GameSettings = {
  ttsEnabled: boolean
  difficulty: "easy" | "medium" | "hard"
  soundEffectsEnabled: boolean
  fruitsEnabled: boolean // Fruit flip mode persisted
}

export type GameState = RoundState & {
  // Game status
  isLoading: boolean

  // Statistics
  stats: GameStats

  // Settings
  settings: GameSettings

  // Bottle progress
  bottleProgress: BottleProgress

  // --- Win / scoring bookkeeping ---
  incrementScore: (points?: number) => void
  incrementCompletedPhrases: () => void
  recordCompletedPhrase: (
    phraseId: string,
    wordCount: number,
    visualLevel?: CEFRLevel,
    phraseDetails?: { targetText: string; blockText: string; targetLang: string; blockLang: string },
    fruitGradient?: [string, string, string]
  ) => void

  // --- Basket → coins meta-loop ---
  removeBasketJars: (count: number) => void // pull the carried jars off the shelf
  addCoins: (n?: number) => void // mint coins (1 per basket)

  // --- Settings / level ---
  toggleFruits: () => void
  updateSettings: (settings: Partial<GameSettings>) => void
  setLevel: (level: CEFRLevel) => void
  setColorIndex: (index: number) => void

  // --- Reset ---
  reset: () => void
  resetGame: () => void

  // --- Derived ---
  getBottleFillPercent: () => number
  isLevelComplete: () => boolean
}

const initialBottleProgress: BottleProgress = {
  currentLevel: "A0",
  phrasesInCurrentBottle: 0,
  bottlesCompletedThisLevel: 0,
  bottleCollection: [],
  currentColorIndex: 0,
  currentBottlePhrases: [],
}

const initialState = {
  ...emptyRoundFields,
  isLoading: false,
  stats: {
    score: 0,
    allTimeScore: 0,
    coins: 0,
    completedPhrases: 0,
    allTimeCompletedPhrases: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalPhrases: 0,
    completedPhraseIds: [],
  } as GameStats,
  settings: {
    ttsEnabled: true,
    difficulty: "medium",
    soundEffectsEnabled: true,
    fruitsEnabled: false,
  } as GameSettings,
  bottleProgress: initialBottleProgress,
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // The round transitions — ONE implementation, shared with cap-squeeze.
      ...createRoundSlice(set, get),

      incrementScore: (points = 10) => {
        set((state) => ({
          stats: {
            ...state.stats,
            score: state.stats.score + points,
          },
        }))
      },

      incrementCompletedPhrases: () => {
        set((state) => {
          const nextStreak = state.stats.currentStreak + 1
          const nextBestStreak = Math.max(state.stats.bestStreak, nextStreak)

          return {
            stats: {
              ...state.stats,
              completedPhrases: state.stats.completedPhrases + 1,
              currentStreak: nextStreak,
              bestStreak: nextBestStreak,
              totalPhrases: state.stats.totalPhrases + 1,
            },
          }
        })
      },

      recordCompletedPhrase: (phraseId, wordCount, visualLevel, phraseDetails, fruitGradient) => {
        set((state) => {
          // Add points based on word count (1 point per word placed)
          const points = wordCount
          const existingIds = state.stats.completedPhraseIds || []

          // Track bottle progress
          const bp = state.bottleProgress || initialBottleProgress
          const newPhrasesInBottle = bp.phrasesInCurrentBottle + 1
          const bottleComplete = newPhrasesInBottle >= 10

          // Create completed phrase entry if details provided
          const completedPhrase: CompletedPhrase | null = phraseDetails ? {
            id: phraseId,
            targetText: phraseDetails.targetText,
            blockText: phraseDetails.blockText,
            targetLang: phraseDetails.targetLang,
            blockLang: phraseDetails.blockLang,
            completedAt: Date.now(),
          } : null

          // Add phrase to current bottle's phrases (fallback for old localStorage without this field)
          const existingPhrases = bp.currentBottlePhrases || []
          const newCurrentBottlePhrases = completedPhrase
            ? [...existingPhrases, completedPhrase]
            : existingPhrases

          // If bottle complete, add to collection and reset
          let newBottleProgress: BottleProgress
          if (bottleComplete) {
            // Use visual level for bottle color (cycles through all colors for variety)
            const bottleLevel = visualLevel || bp.currentLevel
            const levelColors = LEVEL_FRUIT_COLORS[bottleLevel]
            const newBottle: CollectedBottle = {
              id: `bottle-${Date.now()}`,
              level: bottleLevel,
              color: levelColors.primary,
              gradient: fruitGradient || levelColors.gradient, // Store actual fruit gradient
              completedAt: Date.now(),
              phrases: newCurrentBottlePhrases, // Include all phrases from this bottle
            }
            newBottleProgress = {
              ...bp,
              phrasesInCurrentBottle: 0,
              bottlesCompletedThisLevel: Math.min(bp.bottlesCompletedThisLevel + 1, 99), // Cap at 99
              bottleCollection: [...bp.bottleCollection, newBottle],
              currentBottlePhrases: [], // Reset for next bottle
            }
          } else {
            newBottleProgress = {
              ...bp,
              phrasesInCurrentBottle: newPhrasesInBottle,
              currentBottlePhrases: newCurrentBottlePhrases,
            }
          }

          return {
            stats: {
              ...state.stats,
              allTimeScore: (state.stats.allTimeScore || 0) + points,
              allTimeCompletedPhrases: (state.stats.allTimeCompletedPhrases || 0) + 1,
              completedPhraseIds: [...existingIds, phraseId],
            },
            bottleProgress: newBottleProgress,
          }
        })
      },

      // Carry a basket off the shelf: drop the oldest `count` collected jars.
      removeBasketJars: (count) => {
        set((state) => ({
          bottleProgress: {
            ...state.bottleProgress,
            bottleCollection: state.bottleProgress.bottleCollection.slice(count),
          },
        }))
      },

      // Mint coins (1 per carried basket) onto the persistent gold total.
      addCoins: (n = 1) => {
        set((state) => ({
          stats: { ...state.stats, coins: (state.stats.coins || 0) + n },
        }))
      },

      toggleFruits: () => {
        set((state) => ({
          settings: {
            ...state.settings,
            fruitsEnabled: !state.settings.fruitsEnabled,
          },
        }))
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ...newSettings,
          },
        }))
      },

      setLevel: (level) => {
        set((state) => ({
          bottleProgress: {
            ...state.bottleProgress,
            currentLevel: level,
            phrasesInCurrentBottle: 0,
            bottlesCompletedThisLevel: 0,
          },
        }))
      },

      setColorIndex: (index) => {
        set((state) => ({
          bottleProgress: {
            ...state.bottleProgress,
            currentColorIndex: index,
          },
        }))
      },

      // Reset only the current phrase + block layout (keeps stats/settings/bottles).
      // Equivalent to the shipped resetBlocks(), adapted to the array model.
      reset: () => {
        set({
          phrase: emptyPhrase,
          blocks: {},
          correctWords: [],
          bankOrder: [],
          sentenceRows: [],
          hasWon: false,
        })
      },

      // Reset all session state but keep persisted stats + settings (shipped resetGame()).
      resetGame: () => {
        set({
          ...initialState,
          stats: get().stats, // Keep stats
          settings: get().settings, // Keep settings
        })
      },

      getBottleFillPercent: () => {
        const state = get()
        const bp = state.bottleProgress || initialBottleProgress
        return (bp.phrasesInCurrentBottle / 10) * 100
      },

      isLevelComplete: () => {
        const state = get()
        const bp = state.bottleProgress || initialBottleProgress
        const bottlesNeeded = BOTTLES_PER_LEVEL[bp.currentLevel]
        return bp.bottlesCompletedThisLevel >= bottlesNeeded
      },
    }),
    {
      name: "juice-squeeze-game-state",
      storage: createJSONStorage(() => localStorage),
      // Deep-merge persisted partial into the initial state. partialize only
      // saves all-time stat fields; without a nested merge, zustand's default
      // shallow merge would replace the whole `stats` object and leave session
      // fields (score/completedPhrases/currentStreak) undefined -> NaN on use.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>
        return {
          ...current,
          ...p,
          stats: { ...current.stats, ...(p.stats ?? {}) },
          settings: { ...current.settings, ...(p.settings ?? {}) },
          bottleProgress: { ...current.bottleProgress, ...(p.bottleProgress ?? {}) },
        }
      },
      partialize: (state) => ({
        stats: {
          allTimeScore: state.stats.allTimeScore,
          coins: state.stats.coins,
          allTimeCompletedPhrases: state.stats.allTimeCompletedPhrases,
          bestStreak: state.stats.bestStreak,
          totalPhrases: state.stats.totalPhrases,
          completedPhraseIds: state.stats.completedPhraseIds,
          // Don't persist session stats (score, completedPhrases, currentStreak)
        },
        settings: state.settings,
        bottleProgress: state.bottleProgress, // Persist bottle collection and level progress
        // Don't persist current phrase/blocks - reload fresh each session
      }),
    }
  )
)
