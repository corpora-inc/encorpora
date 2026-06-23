/**
 * Game store for Juice Squeeze (Fire rebuild) — Zustand.
 *
 * Ported from the shipped pack's store/gameState.ts. All score / settings /
 * bottle-progress / level bookkeeping is VERBATIM (same persist key, same
 * partialize shape, so existing users' collections survive an in-place upgrade).
 *
 * The Babylon 3D block model (x/y/z mesh coords, placeBlock/updateBlockPosition,
 * win-by-X-position) has been REPLACED with a rendering-agnostic array model
 * suitable for dnd-kit. RTL / reading-order math is NOT in this store — it is a
 * DOM-layout concern. The UI flattens placed blocks into reading order and
 * passes that array to checkWin().
 *
 * ============================================================================
 * PUBLIC API (build the UI against this)
 * ============================================================================
 *
 * Persist localStorage key: "juice-squeeze-game-state"   (UNCHANGED from shipped)
 *
 * --- State fields ---
 *   stats: GameStats
 *   settings: GameSettings
 *   bottleProgress: BottleProgress
 *   hasWon: boolean
 *   isLoading: boolean
 *   // Current-phrase metadata (block/target text + langs + level + source)
 *   phrase: PhraseMeta
 *   // Rendering-agnostic block model:
 *   blocks: Record<string, BlockState>   // id -> { id, word, originalIndex }
 *   correctWords: string[]               // tokenized block-lang text, correct order
 *   bankOrder: string[]                  // block ids still in the word bank
 *   sentenceRows: string[][]             // block ids placed in sentence area (row-major)
 *
 * --- Actions ---
 *   loadPhrase(utterance: PhraseInput): void
 *   moveToSentence(blockId, row?, index?): void   // bank -> sentence
 *   moveToBank(blockId, index?): void             // sentence -> bank
 *   reorderWithinSentence(blockId, toRow, toIndex): void
 *   reorderWithinBank(blockId, toIndex): void
 *   checkWin(playerWordsInReadingOrder: string[]): boolean   // PURE compare to correctWords
 *   setWon(won: boolean): void
 *   incrementScore(points?: number): void
 *   incrementCompletedPhrases(): void
 *   recordCompletedPhrase(phraseId, wordCount, visualLevel?, phraseDetails?, fruitGradient?): void
 *   toggleFruits(): void
 *   updateSettings(partial: Partial<GameSettings>): void
 *   setLevel(level: CEFRLevel): void
 *   setColorIndex(index: number): void
 *   reset(): void                         // reset current phrase/blocks (keeps stats/settings/bottles)
 *   resetGame(): void                     // reset all session state (keeps persisted stats/settings)
 *   getBottleFillPercent(): number        // phrasesInCurrentBottle / 10 * 100
 *   isLevelComplete(): boolean            // bottlesCompletedThisLevel >= BOTTLES_PER_LEVEL[currentLevel]
 *   getSentenceWords(): string[]          // placed block ids -> words, row-major reading order
 * ============================================================================
 */

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { LEVEL_FRUIT_COLORS, BOTTLES_PER_LEVEL, type CEFRLevel } from "./fruits"

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

// Current-phrase metadata (display + tagging). Word ORDER lives in correctWords.
export type PhraseMeta = {
  id: string | null
  targetText: string | null // Text in target language (to display at top)
  blockText: string | null // Text in block language (for word blocks)
  targetLang: string | null
  blockLang: string | null
  level: string | null // CEFR level of this phrase's entry
  source?: string // "base" or phrase-pack id
}

// Rendering-agnostic word block (replaces the Babylon mesh block).
export type BlockState = {
  id: string
  word: string
  originalIndex: number
}

// Input accepted by loadPhrase — shaped like a loaded Utterance.
export type PhraseInput = {
  id: string
  level: string
  text: string // block-language text
  words: string[] // tokenized block-language words (correct order)
  targetText?: string
  targetLang?: string
  blockLang?: string
  source?: string
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

export type GameState = {
  // Current phrase metadata
  phrase: PhraseMeta

  // Rendering-agnostic block model
  blocks: Record<string, BlockState>
  correctWords: string[]
  bankOrder: string[]
  sentenceRows: string[][]

  // Game status
  hasWon: boolean
  isLoading: boolean

  // Statistics
  stats: GameStats

  // Settings
  settings: GameSettings

  // Bottle progress
  bottleProgress: BottleProgress

  // --- Phrase / block actions ---
  loadPhrase: (utterance: PhraseInput) => void
  moveToSentence: (blockId: string, row?: number, index?: number) => void
  moveToBank: (blockId: string, index?: number) => void
  reorderWithinSentence: (blockId: string, toRow: number, toIndex: number) => void
  reorderWithinBank: (blockId: string, toIndex: number) => void
  getSentenceWords: () => string[]
  checkWin: (playerWordsInReadingOrder: string[]) => boolean

  // --- Win / scoring bookkeeping ---
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

const emptyPhrase: PhraseMeta = {
  id: null,
  targetText: null,
  blockText: null,
  targetLang: null,
  blockLang: null,
  level: null,
  source: undefined,
}

const initialState = {
  phrase: emptyPhrase,
  blocks: {} as Record<string, BlockState>,
  correctWords: [] as string[],
  bankOrder: [] as string[],
  sentenceRows: [] as string[][],
  hasWon: false,
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

// Remove a block id from wherever it currently sits (bank or any sentence row).
// Returns fresh bankOrder + sentenceRows with the id removed.
const removeBlockId = (
  bankOrder: string[],
  sentenceRows: string[][],
  blockId: string
): { bankOrder: string[]; sentenceRows: string[][] } => {
  return {
    bankOrder: bankOrder.filter((id) => id !== blockId),
    sentenceRows: sentenceRows.map((r) => r.filter((id) => id !== blockId)),
  }
}

// Fisher-Yates shuffle (returns a new array). Used to scramble the word bank so
// the correct order is NOT pre-laid-out for the player (shipped parity).
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Shuffle ids for the bank; re-roll a few times if it lands on the exact
// original order (so short phrases don't occasionally show the answer).
const shuffledBank = (ids: string[]): string[] => {
  if (ids.length < 2) return [...ids]
  let out = shuffle(ids)
  let tries = 0
  while (tries < 8 && out.every((id, i) => id === ids[i])) {
    out = shuffle(ids)
    tries++
  }
  return out
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialState,

      loadPhrase: (utterance) => {
        // Build rendering-agnostic blocks from the tokenized words.
        // Each token becomes a block; identical tokens get distinct ids via index.
        const blocks: Record<string, BlockState> = {}
        const ids: string[] = []
        utterance.words.forEach((word, originalIndex) => {
          const id = `block-${originalIndex}`
          blocks[id] = { id, word, originalIndex }
          ids.push(id)
        })

        set(() => ({
          phrase: {
            id: utterance.id,
            targetText: utterance.targetText ?? null,
            blockText: utterance.text,
            targetLang: utterance.targetLang ?? null,
            blockLang: utterance.blockLang ?? null,
            level: utterance.level,
            source: utterance.source,
          },
          blocks,
          correctWords: [...utterance.words],
          bankOrder: shuffledBank(ids), // scramble so the answer isn't pre-laid-out
          sentenceRows: [[]], // one empty sentence row to start
          hasWon: false,
          isLoading: false,
        }))
      },

      moveToSentence: (blockId, row, index) => {
        set((state) => {
          if (!state.blocks[blockId]) return state
          const { bankOrder, sentenceRows } = removeBlockId(
            state.bankOrder,
            state.sentenceRows,
            blockId
          )
          const rows = sentenceRows.length > 0 ? sentenceRows : [[]]
          const targetRow = row ?? rows.length - 1
          const safeRow = Math.max(0, Math.min(targetRow, rows.length - 1))
          const newRows = rows.map((r, i) => {
            if (i !== safeRow) return r
            const copy = [...r]
            const at = index === undefined ? copy.length : Math.max(0, Math.min(index, copy.length))
            copy.splice(at, 0, blockId)
            return copy
          })
          return { bankOrder, sentenceRows: newRows }
        })
      },

      moveToBank: (blockId, index) => {
        set((state) => {
          if (!state.blocks[blockId]) return state
          const removed = removeBlockId(state.bankOrder, state.sentenceRows, blockId)
          const copy = [...removed.bankOrder]
          const at = index === undefined ? copy.length : Math.max(0, Math.min(index, copy.length))
          copy.splice(at, 0, blockId)
          return { bankOrder: copy, sentenceRows: removed.sentenceRows }
        })
      },

      reorderWithinSentence: (blockId, toRow, toIndex) => {
        set((state) => {
          if (!state.blocks[blockId]) return state
          const removed = removeBlockId(state.bankOrder, state.sentenceRows, blockId)
          const rows = removed.sentenceRows.length > 0 ? removed.sentenceRows : [[]]
          const safeRow = Math.max(0, Math.min(toRow, rows.length - 1))
          const newRows = rows.map((r, i) => {
            if (i !== safeRow) return r
            const copy = [...r]
            const at = Math.max(0, Math.min(toIndex, copy.length))
            copy.splice(at, 0, blockId)
            return copy
          })
          return { bankOrder: removed.bankOrder, sentenceRows: newRows }
        })
      },

      reorderWithinBank: (blockId, toIndex) => {
        set((state) => {
          if (!state.blocks[blockId]) return state
          const removed = removeBlockId(state.bankOrder, state.sentenceRows, blockId)
          const copy = [...removed.bankOrder]
          const at = Math.max(0, Math.min(toIndex, copy.length))
          copy.splice(at, 0, blockId)
          return { bankOrder: copy, sentenceRows: removed.sentenceRows }
        })
      },

      getSentenceWords: () => {
        const state = get()
        return state.sentenceRows
          .flat()
          .map((id) => state.blocks[id]?.word)
          .filter((w): w is string => typeof w === "string")
      },

      // PURE win check: compare the player's already-flattened reading-order
      // words to the correct order, token-for-token. RTL flattening is done by
      // the caller (DOM layer) — the store only compares plain arrays.
      checkWin: (playerWordsInReadingOrder) => {
        const { correctWords } = get()
        if (correctWords.length === 0) return false
        if (playerWordsInReadingOrder.length !== correctWords.length) return false
        return playerWordsInReadingOrder.every((word, i) => word === correctWords[i])
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
