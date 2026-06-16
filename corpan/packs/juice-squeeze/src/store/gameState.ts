// This pack is a vanilla DOM game (no React). Import from `zustand/vanilla`
// so the bundle never pulls in `react` — the root `zustand` entry's React
// binding made the IIFE build throw "Could not resolve 'react'" at init,
// which silently prevented registerGame() from ever running.
import { createStore as create } from "zustand/vanilla"
import { persist, createJSONStorage } from "zustand/middleware"

// Fruit definition type
export type FruitDef = {
  fruit: string
  name: string
  primary: string
  gradient: [string, string, string]
  level: "A0" | "A1" | "A2" | "B1" | "B2" | "C1"
}

// Tropical fruit palette - 16 unique fruits (A0-B1 levels)
// Each fruit has a unique emoji to avoid confusion
export const TROPICAL_FRUITS: Record<string, FruitDef> = {
  // A0 - Common citrus/orchard (beginner, familiar fruits)
  orange: { fruit: "🍊", name: "Orange", primary: "#FF9800", gradient: ["#FFB84D", "#FF9800", "#E65100"], level: "A0" },
  lemon: { fruit: "🍋", name: "Lemon", primary: "#FFF176", gradient: ["#FFFF8D", "#FFF176", "#F9A825"], level: "A0" },
  apple: { fruit: "🍎", name: "Apple", primary: "#E53935", gradient: ["#EF5350", "#E53935", "#C62828"], level: "A0" },
  greenApple: { fruit: "🍏", name: "Green Apple", primary: "#8BC34A", gradient: ["#AED581", "#8BC34A", "#689F38"], level: "A0" },

  // A1 - Tropical basics (slightly more exotic but well-known)
  mango: { fruit: "🥭", name: "Mango", primary: "#FFCC02", gradient: ["#FFE066", "#FFCC02", "#E6B800"], level: "A1" },
  peach: { fruit: "🍑", name: "Peach", primary: "#FFAB91", gradient: ["#FFCCBC", "#FFAB91", "#FF8A65"], level: "A1" },
  pear: { fruit: "🍐", name: "Pear", primary: "#C5E1A5", gradient: ["#DCEDC8", "#C5E1A5", "#9CCC65"], level: "A1" },
  melon: { fruit: "🍈", name: "Melon", primary: "#A5D6A7", gradient: ["#C8E6C9", "#A5D6A7", "#81C784"], level: "A1" },

  // A2 - Tropical fruits (more vibrant, tropical)
  pineapple: { fruit: "🍍", name: "Pineapple", primary: "#FFD700", gradient: ["#FFEB3B", "#FFD700", "#FFC107"], level: "A2" },
  kiwi: { fruit: "🥝", name: "Kiwi", primary: "#7CB342", gradient: ["#9CCC65", "#7CB342", "#558B2F"], level: "A2" },
  grape: { fruit: "🍇", name: "Grape", primary: "#8E24AA", gradient: ["#BA68C8", "#8E24AA", "#6A1B9A"], level: "A2" },
  blueberry: { fruit: "🫐", name: "Blueberry", primary: "#5C6BC0", gradient: ["#7986CB", "#5C6BC0", "#3949AB"], level: "A2" },

  // B1 - Sweet berries & tropical (bold colors)
  strawberry: { fruit: "🍓", name: "Strawberry", primary: "#E91E63", gradient: ["#F06292", "#E91E63", "#C2185B"], level: "B1" },
  cherry: { fruit: "🍒", name: "Cherry", primary: "#D32F2F", gradient: ["#EF5350", "#D32F2F", "#B71C1C"], level: "B1" },
  watermelon: { fruit: "🍉", name: "Watermelon", primary: "#FF6B6B", gradient: ["#FF8A8A", "#FF6B6B", "#E53935"], level: "B1" },
  coconut: { fruit: "🥥", name: "Coconut", primary: "#BCAAA4", gradient: ["#D7CCC8", "#BCAAA4", "#8D6E63"], level: "B1" },

} as const

// Get fruits by level
export const getFruitsByLevel = (level: "A0" | "A1" | "A2" | "B1" | "B2" | "C1"): FruitDef[] => {
  return Object.values(TROPICAL_FRUITS).filter(f => f.level === level)
}

// Get all fruits (for "all levels" mode)
export const getAllFruits = (): FruitDef[] => {
  return Object.values(TROPICAL_FRUITS)
}

// Get fruit by cycling through available fruits based on index
export const getFruitByIndex = (level: "A0" | "A1" | "A2" | "B1" | "B2" | "C1" | "all", index: number): FruitDef => {
  const fruits = level === "all" ? getAllFruits() : getFruitsByLevel(level)
  return fruits[index % fruits.length]
}

// Level-based fruit colors - uses first fruit of each level for backward compatibility
// Note: B2/C1 reuse fruits from lower levels since we removed duplicate emojis
export const LEVEL_FRUIT_COLORS = {
  A0: TROPICAL_FRUITS.orange,
  A1: TROPICAL_FRUITS.mango,
  A2: TROPICAL_FRUITS.pineapple,
  B1: TROPICAL_FRUITS.strawberry,
  B2: TROPICAL_FRUITS.kiwi,        // Green (distinct color)
  C1: TROPICAL_FRUITS.grape,       // Purple (distinct color)
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
  recordCompletedPhrase: (
    phraseId: string,
    wordCount: number,
    visualLevel?: CEFRLevel,
    phraseDetails?: { targetText: string; blockText: string; targetLang: string; blockLang: string },
    fruitGradient?: [string, string, string]
  ) => void
  toggleFruits: () => void
  resetGame: () => void
  updateSettings: (settings: Partial<GameSettings>) => void
  resetBlocks: () => void
  setLevel: (level: CEFRLevel) => void
  setColorIndex: (index: number) => void
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

      setColorIndex: (index) => {
        set((state) => ({
          bottleProgress: {
            ...state.bottleProgress,
            currentColorIndex: index,
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
