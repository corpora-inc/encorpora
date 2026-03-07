import type { HostApi, StackConfig } from "./types"

const defaultStackConfig: StackConfig = {
  activeStackId: "mock-stargate",
  languages: ["en"],
  domains: [],
  levels: [],
  rate: 1.0,
  textSize: "medium",
  showRomanization: false,
}

export const createMockHostApi = (): HostApi => {
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
