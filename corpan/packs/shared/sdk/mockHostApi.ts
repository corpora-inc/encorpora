import type { HostApi, StackConfig } from "./types"

export function createMockHostApi(readerName = "mock-reader"): HostApi {
  const defaultStackConfig: StackConfig = {
    activeStackId: readerName,
    languages: ["en"],
    domains: [],
    levels: [],
    rate: 1.0,
    textSize: "medium",
    showRomanization: false,
  }

  const listeners = new Set<(next: StackConfig) => void>()

  return {
    speak: (lang: string, text: string) => {
      console.log(`[Mock] speak("${lang}", "${text}")`)
    },
    stopSpeech: () => {
      console.log("[Mock] stopSpeech()")
    },
    getStackConfig: () => defaultStackConfig,
    onStackConfigChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    isMock: true,
  }
}
