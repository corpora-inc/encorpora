import { useEffect, useRef } from "react"
import { useGameStore } from "../store/gameState"

type UseWinDetectionOptions = {
  onWin: () => void
}

export function useWinDetection({ onWin }: UseWinDetectionOptions) {
  const checkWin = useGameStore((s) => s.checkWin)
  const setWon = useGameStore((s) => s.setWon)
  const hasWon = useGameStore((s) => s.hasWon)
  const placementOrder = useGameStore((s) => s.placementOrder)

  const prevHasWon = useRef(hasWon)

  useEffect(() => {
    // Skip if already won
    if (hasWon) return

    // Check win condition
    const won = checkWin()
    if (won) {
      setWon(true)
    }
  }, [placementOrder, hasWon, checkWin, setWon])

  // Call onWin callback when win state changes from false to true
  useEffect(() => {
    if (hasWon && !prevHasWon.current) {
      onWin()
    }
    prevHasWon.current = hasWon
  }, [hasWon, onWin])

  return { hasWon }
}
