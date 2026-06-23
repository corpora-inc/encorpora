import type { GameStore } from "./types"

export const createGameStore = <T extends Record<string, unknown>>(
  initial: T
): GameStore<T> => {
  let state = { ...initial }
  const listeners = new Set<(next: T) => void>()
  const getState = () => state
  const update = (updater: (draft: T) => void) => {
    const next = { ...state }
    updater(next)
    state = next
    listeners.forEach((listener) => listener(state))
  }
  const subscribe = (listener: (next: T) => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  return { getState, update, subscribe }
}
