import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { type CEFRLevel, type FruitDef, BOTTLES_PER_LEVEL, getAllFruits } from "../utils/colors"

// Word block state for React drag-and-drop
export type WordBlock = {
  id: string
  word: string
  originalIndex: number
  zone: "choices" | "placement"
}

// Completed phrase data for review feature
export type CompletedPhrase = {
  id: string
  targetText: string
  blockText: string
  targetLang: string
  blockLang: string
  completedAt: number
}

// Collected bottle data
export type CollectedBottle = {
  id: string
  level: CEFRLevel
  color: string
  gradient?: [string, string, string]
  completedAt: number
  phrases: CompletedPhrase[]
}

// Bottle progress tracking
export type BottleProgress = {
  currentLevel: CEFRLevel
  phrasesInCurrentBottle: number
  bottlesCompletedThisLevel: number
  bottleCollection: CollectedBottle[]
  currentColorIndex: number
  currentBottlePhrases: CompletedPhrase[]
}

// Current phrase data
export type PhraseData = {
  id: string | null
  targetText: string | null
  blockText: string | null
  targetLang: string | null
  blockLang: string | null
  correctWords: string[]
}

// Game statistics
export type GameStats = {
  score: number
  allTimeScore: number
  completedPhrases: number
  allTimeCompletedPhrases: number
  currentStreak: number
  bestStreak: number
  totalPhrases: number
  completedPhraseIds: string[]
}

// Game settings
export type GameSettings = {
  ttsEnabled: boolean
  soundEffectsEnabled: boolean
  fruitsEnabled: boolean
}

// Game state
export type GameState = {
  // Current phrase data
  phrase: PhraseData

  // Word blocks with zone tracking
  blocks: WordBlock[]

  // Placement order (block IDs in order they appear in placement area)
  placementOrder: string[]

  // Game status
  hasWon: boolean
  isLoading: boolean

  // Statistics
  stats: GameStats

  // Settings
  settings: GameSettings

  // Bottle progress
  bottleProgress: BottleProgress

  // Actions
  loadPhrase: (phrase: Omit<PhraseData, "correctWords"> & { correctWords: string[] }, blocks: WordBlock[]) => void
  moveBlockToPlacement: (blockId: string, insertIndex?: number) => void
  moveBlockToChoices: (blockId: string) => void
  reorderPlacement: (activeId: string, overId: string) => void
  checkWin: () => boolean
  setWon: (won: boolean) => void
  recordWin: (wordCount: number, phraseDetails?: { targetText: string; blockText: string; targetLang: string; blockLang: string }, fruitGradient?: [string, string, string]) => void
  toggleFruits: () => void
  updateSettings: (settings: Partial<GameSettings>) => void
  resetBlocks: () => void
  setLevel: (level: CEFRLevel) => void
  setColorIndex: (index: number) => void
  getBottleFillPercent: () => number
  isLevelComplete: () => boolean
  getCurrentFruit: () => FruitDef
  advanceColorIndex: () => void
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
  phrase: {
    id: null,
    targetText: null,
    blockText: null,
    targetLang: null,
    blockLang: null,
    correctWords: [],
  } as PhraseData,
  blocks: [] as WordBlock[],
  placementOrder: [] as string[],
  hasWon: false,
  isLoading: false,
  stats: {
    score: 0,
    allTimeScore: 0,
    completedPhrases: 0,
    allTimeCompletedPhrases: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalPhrases: 0,
    completedPhraseIds: [],
  } as GameStats,
  settings: {
    ttsEnabled: true,
    soundEffectsEnabled: true,
    fruitsEnabled: false,
  } as GameSettings,
  bottleProgress: initialBottleProgress,
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialState,

      loadPhrase: (phrase, blocks) => {
        set({
          phrase: { ...phrase, correctWords: [...phrase.correctWords] },
          blocks,
          placementOrder: [],
          hasWon: false,
          isLoading: false,
        })
      },

      moveBlockToPlacement: (blockId, insertIndex) => {
        set((state) => {
          const blockIndex = state.blocks.findIndex(b => b.id === blockId)
          if (blockIndex === -1) return state

          const block = state.blocks[blockIndex]
          if (block.zone === "placement") return state

          const newBlocks = [...state.blocks]
          newBlocks[blockIndex] = { ...block, zone: "placement" }

          const newPlacementOrder = [...state.placementOrder]
          if (insertIndex !== undefined && insertIndex >= 0) {
            newPlacementOrder.splice(insertIndex, 0, blockId)
          } else {
            newPlacementOrder.push(blockId)
          }

          return { blocks: newBlocks, placementOrder: newPlacementOrder }
        })
      },

      moveBlockToChoices: (blockId) => {
        set((state) => {
          const blockIndex = state.blocks.findIndex(b => b.id === blockId)
          if (blockIndex === -1) return state

          const block = state.blocks[blockIndex]
          if (block.zone === "choices") return state

          const newBlocks = [...state.blocks]
          newBlocks[blockIndex] = { ...block, zone: "choices" }

          const newPlacementOrder = state.placementOrder.filter(id => id !== blockId)

          return { blocks: newBlocks, placementOrder: newPlacementOrder }
        })
      },

      reorderPlacement: (activeId, overId) => {
        set((state) => {
          const oldIndex = state.placementOrder.indexOf(activeId)
          const newIndex = state.placementOrder.indexOf(overId)
          if (oldIndex === -1 || newIndex === -1) return state

          const newOrder = [...state.placementOrder]
          newOrder.splice(oldIndex, 1)
          newOrder.splice(newIndex, 0, activeId)

          return { placementOrder: newOrder }
        })
      },

      checkWin: () => {
        const state = get()
        const { phrase, blocks, placementOrder } = state

        if (phrase.correctWords.length === 0) return false

        // Get words in placement order
        const placedWords = placementOrder
          .map(id => blocks.find(b => b.id === id))
          .filter((b): b is WordBlock => b !== undefined)
          .map(b => b.word)

        if (placedWords.length !== phrase.correctWords.length) return false

        return placedWords.every((word, i) => word === phrase.correctWords[i])
      },

      setWon: (won) => {
        set({ hasWon: won })
      },

      recordWin: (wordCount, phraseDetails, fruitGradient) => {
        set((state) => {
          const points = wordCount
          const phraseId = state.phrase.id || `phrase-${Date.now()}`
          const existingIds = state.stats.completedPhraseIds || []

          const bp = state.bottleProgress || initialBottleProgress
          const newPhrasesInBottle = bp.phrasesInCurrentBottle + 1
          const bottleComplete = newPhrasesInBottle >= 10

          const completedPhrase: CompletedPhrase | null = phraseDetails ? {
            id: phraseId,
            targetText: phraseDetails.targetText,
            blockText: phraseDetails.blockText,
            targetLang: phraseDetails.targetLang,
            blockLang: phraseDetails.blockLang,
            completedAt: Date.now(),
          } : null

          const existingPhrases = bp.currentBottlePhrases || []
          const newCurrentBottlePhrases = completedPhrase
            ? [...existingPhrases, completedPhrase]
            : existingPhrases

          let newBottleProgress: BottleProgress
          if (bottleComplete) {
            const allFruits = getAllFruits()
            const currentFruit = allFruits[bp.currentColorIndex % allFruits.length]
            const newBottle: CollectedBottle = {
              id: `bottle-${Date.now()}`,
              level: currentFruit.level,
              color: currentFruit.primary,
              gradient: fruitGradient || currentFruit.gradient,
              completedAt: Date.now(),
              phrases: newCurrentBottlePhrases,
            }
            newBottleProgress = {
              ...bp,
              phrasesInCurrentBottle: 0,
              bottlesCompletedThisLevel: Math.min(bp.bottlesCompletedThisLevel + 1, 99),
              bottleCollection: [...bp.bottleCollection, newBottle],
              currentBottlePhrases: [],
              currentColorIndex: (bp.currentColorIndex + 1) % allFruits.length,
            }
          } else {
            newBottleProgress = {
              ...bp,
              phrasesInCurrentBottle: newPhrasesInBottle,
              currentBottlePhrases: newCurrentBottlePhrases,
            }
          }

          const nextStreak = state.stats.currentStreak + 1
          const nextBestStreak = Math.max(state.stats.bestStreak, nextStreak)

          return {
            stats: {
              ...state.stats,
              score: state.stats.score + points,
              allTimeScore: (state.stats.allTimeScore || 0) + points,
              completedPhrases: state.stats.completedPhrases + 1,
              allTimeCompletedPhrases: (state.stats.allTimeCompletedPhrases || 0) + 1,
              currentStreak: nextStreak,
              bestStreak: nextBestStreak,
              totalPhrases: state.stats.totalPhrases + 1,
              completedPhraseIds: [...existingIds, phraseId],
            },
            bottleProgress: newBottleProgress,
          }
        })
      },

      toggleFruits: () => {
        set((state) => ({
          settings: { ...state.settings, fruitsEnabled: !state.settings.fruitsEnabled },
        }))
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }))
      },

      resetBlocks: () => {
        set((state) => ({
          blocks: state.blocks.map(b => ({ ...b, zone: "choices" as const })),
          placementOrder: [],
          hasWon: false,
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
          bottleProgress: { ...state.bottleProgress, currentColorIndex: index },
        }))
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

      getCurrentFruit: () => {
        const state = get()
        const bp = state.bottleProgress || initialBottleProgress
        const allFruits = getAllFruits()
        return allFruits[bp.currentColorIndex % allFruits.length]
      },

      advanceColorIndex: () => {
        set((state) => {
          const allFruits = getAllFruits()
          return {
            bottleProgress: {
              ...state.bottleProgress,
              currentColorIndex: (state.bottleProgress.currentColorIndex + 1) % allFruits.length,
            },
          }
        })
      },
    }),
    {
      name: "juice-squeeze2-game-state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        stats: {
          allTimeScore: state.stats.allTimeScore,
          allTimeCompletedPhrases: state.stats.allTimeCompletedPhrases,
          bestStreak: state.stats.bestStreak,
          totalPhrases: state.stats.totalPhrases,
          completedPhraseIds: state.stats.completedPhraseIds,
        },
        settings: state.settings,
        bottleProgress: state.bottleProgress,
      }),
    }
  )
)

// Re-export types from colors for convenience
export { type CEFRLevel, type FruitDef, LEVEL_FRUIT_COLORS, BOTTLES_PER_LEVEL, getAllFruits } from "../utils/colors"
