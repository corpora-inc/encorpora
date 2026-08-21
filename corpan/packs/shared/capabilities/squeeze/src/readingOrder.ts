/**
 * Reading-order flattening for the dnd-kit sentence area.
 *
 * The store's checkWin() is a pure array compare; RTL handling is a DOM-layout
 * concern (see rtl.ts). This helper flattens the placed blocks (sentenceRows of
 * block ids) into the player's reading order:
 *   - row-major, top -> bottom
 *   - within a row: left -> right for LTR, right -> left for RTL
 *
 * Mirrors the shipped checkWin sort (game.ts ~1436): rows ascending, then X
 * ascending (LTR) or descending (RTL). In the array model "X ascending" is the
 * stored row order; RTL just reverses each row.
 */
import type { BlockState } from "./roundStore"

export function flattenReadingOrder(
  sentenceRows: string[][],
  blocks: Record<string, BlockState>,
  rtl: boolean
): string[] {
  const words: string[] = []
  for (const row of sentenceRows) {
    const ordered = rtl ? [...row].reverse() : row
    for (const id of ordered) {
      const w = blocks[id]?.word
      if (typeof w === "string") words.push(w)
    }
  }
  return words
}
