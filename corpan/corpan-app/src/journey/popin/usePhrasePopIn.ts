// src/journey/popin/usePhrasePopIn.ts — long-press binding for the phrase
// pop-in (capability-modules.md §5). WordExplanationText gesture contract:
// LONG_PRESS_MS = 450, deliberate long-press/right-click only, movement
// cancels, the post-press tap is swallowed.

import { useCallback, useRef } from "react"
import { requestPhrasePopIn, type PhrasePopInRequest } from "./popinBus.ts"

export const LONG_PRESS_MS = 450
const MOVE_CANCEL_PX = 10

export function usePhrasePopIn(req: () => PhrasePopInRequest | null) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    origin.current = null
  }, [])

  const fire = useCallback(() => {
    const r = req()
    if (!r) return
    fired.current = true
    requestPhrasePopIn(r)
  }, [req])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      fired.current = false
      origin.current = { x: e.clientX, y: e.clientY }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(fire, LONG_PRESS_MS)
    },
    [fire],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!origin.current) return
      const dx = e.clientX - origin.current.x
      const dy = e.clientY - origin.current.y
      if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) cancel()
    },
    [cancel],
  )

  const onPointerUp = useCallback(cancel, [cancel])
  const onPointerLeave = useCallback(cancel, [cancel])

  /** Swallow the tap that follows a fired long-press. */
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (fired.current) {
      e.preventDefault()
      e.stopPropagation()
      fired.current = false
    }
  }, [])

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      fire()
    },
    [fire],
  )

  return { onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onClickCapture, onContextMenu }
}
