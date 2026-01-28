import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

// Level-based fruit colors for juice
export const LEVEL_FRUIT_COLORS = {
  A0: { fruit: "🍊", name: "Orange", primary: "#FF9800", gradient: ["#FFB84D", "#FF9800", "#E65100"] },
  A1: { fruit: "🥭", name: "Mango", primary: "#FFCC02", gradient: ["#FFE066", "#FFCC02", "#E6B800"] },
  A2: { fruit: "🍍", name: "Pineapple", primary: "#FFD700", gradient: ["#FFEB3B", "#FFD700", "#FFC107"] },
  B1: { fruit: "🍇", name: "Grape", primary: "#8E24AA", gradient: ["#BA68C8", "#8E24AA", "#6A1B9A"] },
  B2: { fruit: "🩷", name: "Papaya", primary: "#FF6B9D", gradient: ["#FF8FB3", "#FF6B9D", "#E91E63"] },
  C1: { fruit: "🫐", name: "Passion", primary: "#5C1A7A", gradient: ["#7B1FA2", "#5C1A7A", "#4A0072"] },
} as const

// Bottles required per level (based on difficulty progression)
export const BOTTLES_PER_LEVEL = {
  A0: 3,
  A1: 5,
  A2: 7,
  B1: 10,
  B2: 12,
  C1: 15,
} as const

export type CEFRLevel = keyof typeof LEVEL_FRUIT_COLORS

// Collected bottle data
export type CollectedBottle = {
  id: string
  level: CEFRLevel
  color: string
  completedAt: number // timestamp
}

// Bottle progress tracking
export type BottleProgress = {
  currentLevel: CEFRLevel
  phrasesInCurrentBottle: number // 0-10, resets when bottle completes
  bottlesCompletedThisLevel: number
  bottleCollection: CollectedBottle[]
}

// Game phrase data
export type PhraseData = {
  id: string | null
  targetText: string | null // Text in target language (to display at top)
  blockText: string | null // Text in block language (for word blocks)
  targetLang: string | null
  blockLang: string | null
  correctWords: string[] // Correct word order in block language
  words: string[] // Current word tokens
}

// Word block state
export type BlockState = {
  id: string
  word: string
  originalIndex: number
  isInSentence: boolean
  position: { x: number; y: number; z: number }
  originalPosition: { x: number; y: number; z: number }
}

// Game statistics
export type GameStats = {
  score: number // Session score (resets)
  allTimeScore: number // Persistent all-time score
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

// Game state
export type GameState = {
  // Current phrase data
  phrase: PhraseData

  // Block states
  blocks: Record<string, BlockState>

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
  loadNewPhrase: (phrase: Omit<PhraseData, "correctWords"> & { correctWords: string[] }) => void
  placeBlock: (blockId: string, position: { x: number; y: number; z: number }) => void
  updateBlockPosition: (blockId: string, position: { x: number; y: number; z: number }) => void
  setBlockInSentence: (blockId: string, isInSentence: boolean) => void
  checkWinCondition: () => boolean
  setWon: (won: boolean) => void
  incrementScore: (points?: number) => void
  incrementCompletedPhrases: () => void
  recordCompletedPhrase: (phraseId: string, wordCount: number, visualLevel?: CEFRLevel) => void
  toggleFruits: () => void
  resetGame: () => void
  updateSettings: (settings: Partial<GameSettings>) => void
  resetBlocks: () => void
  setLevel: (level: CEFRLevel) => void
  getBottleFillPercent: () => number
  isLevelComplete: () => boolean
}

const initialBottleProgress: BottleProgress = {
  currentLevel: "A0",
  phrasesInCurrentBottle: 0,
  bottlesCompletedThisLevel: 0,
  bottleCollection: [],
}

const initialState = {
  phrase: {
    id: null,
    targetText: null,
    blockText: null,
    targetLang: null,
    blockLang: null,
    correctWords: [],
    words: [],
  } as PhraseData,
  blocks: {} as Record<string, BlockState>,
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
      
      loadNewPhrase: (phrase) => {
        set(() => ({
          phrase: {
            ...phrase,
            correctWords: [...phrase.correctWords],
          },
          hasWon: false,
          isLoading: false,
          blocks: {}, // Clear blocks - they'll be recreated in game.ts
        }))
      },
      
      placeBlock: (blockId, position) => {
        set((state) => {
          const block = state.blocks[blockId]
          if (!block) return state
          
          return {
            blocks: {
              ...state.blocks,
              [blockId]: {
                ...block,
                position,
              },
            },
          }
        })
      },
      
      updateBlockPosition: (blockId, position) => {
        set((state) => {
          const block = state.blocks[blockId]
          if (!block) return state
          
          return {
            blocks: {
              ...state.blocks,
              [blockId]: {
                ...block,
                position,
              },
            },
          }
        })
      },
      
      setBlockInSentence: (blockId, isInSentence) => {
        set((state) => {
          const block = state.blocks[blockId]
          if (!block) return state
          
          return {
            blocks: {
              ...state.blocks,
              [blockId]: {
                ...block,
                isInSentence,
              },
            },
          }
        })
      },
      
      checkWinCondition: () => {
        const state = get()
        const { phrase, blocks } = state
        
        if (phrase.correctWords.length === 0) return false
        
        // Get blocks in sentence area, sorted by X position
        const blocksInSentence = Object.values(blocks)
          .filter((block) => block.isInSentence)
          .sort((a, b) => a.position.x - b.position.x)
          .map((block) => block.word)
        
        // Check if count matches
        if (blocksInSentence.length !== phrase.correctWords.length) {
          return false
        }
        
        // Check if order matches
        const isCorrect = blocksInSentence.every(
          (word, i) => word === phrase.correctWords[i]
        )
        
        return isCorrect
      },
      
      setWon: (won) => {
        set({ hasWon: won })
      },
      
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

      recordCompletedPhrase: (phraseId, wordCount, visualLevel) => {
        set((state) => {
          // Add points based on word count (1 point per word placed)
          const points = wordCount
          const existingIds = state.stats.completedPhraseIds || []

          // Track bottle progress
          const bp = state.bottleProgress || initialBottleProgress
          const newPhrasesInBottle = bp.phrasesInCurrentBottle + 1
          const bottleComplete = newPhrasesInBottle >= 10

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
              completedAt: Date.now(),
            }
            newBottleProgress = {
              ...bp,
              phrasesInCurrentBottle: 0,
              bottlesCompletedThisLevel: bp.bottlesCompletedThisLevel + 1,
              bottleCollection: [...bp.bottleCollection, newBottle],
            }
          } else {
            newBottleProgress = {
              ...bp,
              phrasesInCurrentBottle: newPhrasesInBottle,
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

      toggleFruits: () => {
        set((state) => ({
          settings: {
            ...state.settings,
            fruitsEnabled: !state.settings.fruitsEnabled,
          },
        }))
      },
      
      resetGame: () => {
        set({
          ...initialState,
          stats: get().stats, // Keep stats
          settings: get().settings, // Keep settings
        })
      },
      
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ...newSettings,
          },
        }))
      },
      
      resetBlocks: () => {
        set({
          blocks: {},
          hasWon: false,
        })
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
      partialize: (state) => ({
        stats: {
          allTimeScore: state.stats.allTimeScore,
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
