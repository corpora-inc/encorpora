// Phrase-scoped round state — the drag-to-rebuild round's block model and
// transitions, MOVED from packs/juice-squeeze/src/state/gameStore.ts
// (capability-modules.md §4.2). Zustand WITHOUT persist: round state dies
// with the handle. Meta-progression (stats/settings/bottles/coins) stays in
// the juice-squeeze pack, whose gameStore now composes `createRoundSlice`
// so there is exactly ONE implementation of the transitions.
import { createStore, type StoreApi } from "zustand/vanilla"
import { useStore } from "zustand"
import { createContext, useContext } from "react"

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

export type RoundStateFields = {
  phrase: PhraseMeta
  blocks: Record<string, BlockState>
  correctWords: string[]
  bankOrder: string[]
  sentenceRows: string[][]
  hasWon: boolean
}

export type RoundActions = {
  loadPhrase: (utterance: PhraseInput) => void
  moveToSentence: (blockId: string, row?: number, index?: number) => void
  moveToBank: (blockId: string, index?: number) => void
  reorderWithinSentence: (blockId: string, toRow: number, toIndex: number) => void
  reorderWithinBank: (blockId: string, toIndex: number) => void
  getSentenceWords: () => string[]
  checkWin: (playerWordsInReadingOrder: string[]) => boolean
  setWon: (won: boolean) => void
}

export type RoundState = RoundStateFields & RoundActions

export const emptyPhrase: PhraseMeta = {
  id: null,
  targetText: null,
  blockText: null,
  targetLang: null,
  blockLang: null,
  level: null,
  source: undefined,
}

export const emptyRoundFields: RoundStateFields = {
  phrase: emptyPhrase,
  blocks: {},
  correctWords: [],
  bankOrder: [],
  sentenceRows: [],
  hasWon: false,
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

type RoundSet = (
  partial:
    | Partial<RoundStateFields>
    | ((state: RoundState) => Partial<RoundStateFields>),
) => void

/**
 * The one implementation of the round transitions. The capability's own
 * per-mount store spreads this; so does the juice-squeeze pack's persisted
 * gameStore (whose GameState structurally extends RoundState).
 */
export const createRoundSlice = (set: RoundSet, get: () => RoundState): RoundActions => ({
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
    }))
  },

  moveToSentence: (blockId, row, index) => {
    set((state) => {
      if (!state.blocks[blockId]) return {}
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
      if (!state.blocks[blockId]) return {}
      const removed = removeBlockId(state.bankOrder, state.sentenceRows, blockId)
      const copy = [...removed.bankOrder]
      const at = index === undefined ? copy.length : Math.max(0, Math.min(index, copy.length))
      copy.splice(at, 0, blockId)
      return { bankOrder: copy, sentenceRows: removed.sentenceRows }
    })
  },

  reorderWithinSentence: (blockId, toRow, toIndex) => {
    set((state) => {
      if (!state.blocks[blockId]) return {}
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
      if (!state.blocks[blockId]) return {}
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
})

/** Per-round vanilla store (no persist — round state dies with the handle). */
export const createRoundStore = (): StoreApi<RoundState> =>
  createStore<RoundState>()((set, get) => ({
    ...emptyRoundFields,
    ...createRoundSlice(set as RoundSet, get),
  }))

// ---------------------------------------------------------------- React seam
// Components read round state through this context so the SAME components
// serve (a) the capability's per-mount store and (b) the juice-squeeze pack's
// gameStore (structurally a RoundState superset).

/** Any store whose state structurally extends RoundState qualifies. */
export type RoundStoreApi = StoreApi<RoundState>

const RoundStoreContext = createContext<RoundStoreApi | null>(null)

export const RoundStoreProvider = RoundStoreContext.Provider

export function useRoundStoreApi(): RoundStoreApi {
  const store = useContext(RoundStoreContext)
  if (!store) {
    throw new Error(
      "cap-squeeze components must be rendered inside a <RoundStoreProvider>",
    )
  }
  return store
}

export function useRoundStore<T>(selector: (state: RoundState) => T): T {
  return useStore(useRoundStoreApi(), selector)
}
