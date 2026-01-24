import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

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
  
  // Actions
  loadNewPhrase: (phrase: Omit<PhraseData, "correctWords"> & { correctWords: string[] }) => void
  placeBlock: (blockId: string, position: { x: number; y: number; z: number }) => void
  updateBlockPosition: (blockId: string, position: { x: number; y: number; z: number }) => void
  setBlockInSentence: (blockId: string, isInSentence: boolean) => void
  checkWinCondition: () => boolean
  setWon: (won: boolean) => void
  incrementScore: (points?: number) => void
  incrementCompletedPhrases: () => void
  recordCompletedPhrase: (phraseId: string, wordCount: number) => void
  toggleFruits: () => void
  resetGame: () => void
  updateSettings: (settings: Partial<GameSettings>) => void
  resetBlocks: () => void
}

const initialState: Omit<GameState, keyof Omit<GameState, "phrase" | "blocks" | "stats" | "settings">> = {
  phrase: {
    id: null,
    targetText: null,
    blockText: null,
    targetLang: null,
    blockLang: null,
    correctWords: [],
    words: [],
  },
  blocks: {},
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
  },
  settings: {
    ttsEnabled: true,
    difficulty: "medium",
    soundEffectsEnabled: true,
    fruitsEnabled: false,
  },
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      loadNewPhrase: (phrase) => {
        set((state) => ({
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

      recordCompletedPhrase: (phraseId, wordCount) => {
        set((state) => {
          // Add points based on word count (1 point per word placed)
          const points = wordCount
          const existingIds = state.stats.completedPhraseIds || []

          return {
            stats: {
              ...state.stats,
              allTimeScore: (state.stats.allTimeScore || 0) + points,
              allTimeCompletedPhrases: (state.stats.allTimeCompletedPhrases || 0) + 1,
              completedPhraseIds: [...existingIds, phraseId],
            },
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
        // Don't persist current phrase/blocks - reload fresh each session
      }),
    }
  )
)
