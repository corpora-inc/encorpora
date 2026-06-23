/**
 * TTS hook.
 *
 * Mirrors the shipped pack's `speak` helper: prefer `speakConcurrent` (true
 * overlapping audio) and fall back to `speak`. Also exposes `schedule`, the
 * shipped `scheduleTTS` — a single tracked timeout that is cleared before the
 * next schedule and on unmount, preventing phantom phrase audio when the user
 * exits/reopens or advances quickly.
 */
import { useCallback, useEffect, useRef } from "react"
import type { HostApi } from "../sdk/types"

export function useTTS(hostApi: HostApi) {
  const timeoutRef = useRef<number | null>(null)

  const speak = useCallback(
    (lang: string, text: string) => {
      try {
        if (typeof hostApi.speakConcurrent === "function") {
          Promise.resolve(hostApi.speakConcurrent(lang, text)).catch((err) =>
            console.error("[juice-squeeze] speakConcurrent rejected:", err)
          )
        } else if (typeof hostApi.speak === "function") {
          hostApi.speak(lang, text)
        }
      } catch (err) {
        console.error("[juice-squeeze] TTS error:", err)
      }
    },
    [hostApi]
  )

  const clear = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Schedule speech after delayMs. Clears any pending schedule first.
  const schedule = useCallback(
    (lang: string, text: string, delayMs = 500) => {
      clear()
      timeoutRef.current = window.setTimeout(() => {
        speak(lang, text)
        timeoutRef.current = null
      }, delayMs)
    },
    [clear, speak]
  )

  // Clear any pending TTS on unmount.
  useEffect(() => clear, [clear])

  return { speak, schedule, clear }
}
