// Drag/drop + tap placement routing for the squeeze round — MOVED from
// packs/juice-squeeze/src/app/JuiceSqueezeApp.tsx (onDragEnd body +
// locateBlock). One implementation serves the pack's DndContext and the
// capability's own <SqueezeRound>.
import type { DragEndEvent } from "@dnd-kit/core"
import type { RoundState, RoundStoreApi } from "./roundStore"

// Locate which container + index a block currently sits in, for slot inserts.
export function locateBlock(
  state: Pick<RoundState, "bankOrder" | "sentenceRows">,
  blockId: string,
): { container: "bank" | number; index: number } | null {
  const bankIdx = state.bankOrder.indexOf(blockId)
  if (bankIdx >= 0) return { container: "bank", index: bankIdx }
  for (let r = 0; r < state.sentenceRows.length; r++) {
    const idx = state.sentenceRows[r].indexOf(blockId)
    if (idx >= 0) return { container: r, index: idx }
  }
  return null
}

/**
 * Apply a dnd-kit drag-end to the round store. Returns true when a placement
 * changed (the consumer then re-runs its win check). No-op after a win.
 */
export function routeDragEnd(store: RoundStoreApi, e: DragEndEvent): boolean {
  const blockId = String(e.active.id)
  const over = e.over
  if (!over) return false
  const overId = String(over.id)
  const state = store.getState()
  if (state.hasWon) return false

  if (overId === "bank") {
    state.moveToBank(blockId)
  } else if (overId.startsWith("row-")) {
    const row = Number(overId.slice("row-".length))
    state.moveToSentence(blockId, row)
  } else if (overId.startsWith("slot-")) {
    const targetBlockId = overId.slice("slot-".length)
    if (targetBlockId === blockId) return false
    const loc = locateBlock(state, targetBlockId)
    if (!loc) return false
    if (loc.container === "bank") {
      // Insert before target in the bank. Account for removing self if it was
      // earlier in the bank (store removes-then-inserts, so use the index of
      // the target measured AFTER removal).
      const self = locateBlock(state, blockId)
      let idx = loc.index
      if (self && self.container === "bank" && self.index < loc.index) idx -= 1
      state.moveToBank(blockId, idx)
    } else {
      const row = loc.container
      const self = locateBlock(state, blockId)
      let idx = loc.index
      if (self && self.container === row && self.index < loc.index) idx -= 1
      state.moveToSentence(blockId, row, idx)
    }
  } else {
    return false
  }
  return true
}

/**
 * Tap (no drag): a bank block goes to the END of the sentence; a sentence
 * block returns to the bank. Returns true when a placement changed.
 */
export function routeTap(store: RoundStoreApi, blockId: string): boolean {
  const state = store.getState()
  if (state.hasWon) return false
  const inBank = state.bankOrder.includes(blockId)
  if (inBank) {
    state.moveToSentence(blockId)
  } else {
    state.moveToBank(blockId)
  }
  return true
}
