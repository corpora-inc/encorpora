import { useCallback, useRef } from "react"
import type { HostApi } from "../sdk/types"

export function useTTS(hostApi: HostApi) {
  const timeoutRef = useRef<number | null>(null)

  const speak = useCallback((lang: string, text: string) => {
    if (hostApi.speakConcurrent) {
      hostApi.speakConcurrent(lang, text)
    } else if (hostApi.speak) {
      hostApi.speak(lang, text)
    }
  }, [hostApi])

  const speakWithDelay = useCallback((lang: string, text: string, delayMs: number = 500) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(() => {
      speak(lang, text)
      timeoutRef.current = null
    }, delayMs)
  }, [speak])

  const stop = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (hostApi.stopSpeech) {
      hostApi.stopSpeech()
    }
  }, [hostApi])

  return { speak, speakWithDelay, stop }
}
