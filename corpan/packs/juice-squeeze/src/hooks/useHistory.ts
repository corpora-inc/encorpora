/**
 * In-memory phrase history for prev/next navigation.
 *
 * Mirrors the shipped pack's utteranceHistory + historyIndex (game.ts ~1968).
 * Each entry stores the loaded Utterance plus the target/block langs that were
 * picked for it, so going back re-displays the prior phrase with the SAME langs
 * (re-running loadPhrase) rather than re-rolling the language pair.
 *
 * Capped at ~20 entries (shipped is unbounded, but we cap for memory). New
 * entries pushed while not at the end truncate the forward history, matching
 * shipped behavior.
 */
import { useCallback, useRef, useState } from "react"
import type { Utterance } from "../util/phraseLoader"

export type HistoryEntry = {
  utterance: Utterance
  targetLang: string
  blockLang: string
}

const MAX_HISTORY = 20

export function useHistory() {
  const entriesRef = useRef<HistoryEntry[]>([])
  const [index, setIndex] = useState(-1)
  const indexRef = useRef(-1)

  const setIdx = useCallback((i: number) => {
    indexRef.current = i
    setIndex(i)
  }, [])

  // Push a freshly-loaded phrase. Truncates forward history if not at the end.
  const push = useCallback(
    (entry: HistoryEntry) => {
      const cur = indexRef.current
      let next = entriesRef.current
      if (cur < next.length - 1) {
        next = next.slice(0, cur + 1)
      }
      next = [...next, entry]
      if (next.length > MAX_HISTORY) {
        next = next.slice(next.length - MAX_HISTORY)
      }
      entriesRef.current = next
      setIdx(next.length - 1)
    },
    [setIdx]
  )

  const goPrev = useCallback((): HistoryEntry | null => {
    const cur = indexRef.current
    if (cur > 0) {
      const ni = cur - 1
      setIdx(ni)
      return entriesRef.current[ni]
    }
    return null
  }, [setIdx])

  // Returns the next stored entry, or null if at the end (caller loads new).
  const goNext = useCallback((): HistoryEntry | null => {
    const cur = indexRef.current
    if (cur < entriesRef.current.length - 1) {
      const ni = cur + 1
      setIdx(ni)
      return entriesRef.current[ni]
    }
    return null
  }, [setIdx])

  const canPrev = index > 0
  // Next is always allowed: stored entry if available, else load a fresh phrase.
  const canNext = true

  return { push, goPrev, goNext, canPrev, canNext, index }
}
