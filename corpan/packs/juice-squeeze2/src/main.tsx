import React from "react"
import ReactDOM from "react-dom/client"
import "./styles/index.css"
import { App } from "./App"
import type { GameModule, HostApi, StackConfig } from "./sdk/types"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __juiceSqueeze2?: { unmount: () => void }
  __corpanHostActive?: boolean
}

const GAME_ID = "juice_squeeze2"

type MountResult = {
  unmount: () => void
}

function mountGame(
  container: HTMLElement,
  hostApi: HostApi,
  _initialState?: Record<string, unknown>
): MountResult {
  const root = ReactDOM.createRoot(container)

  const handleExit = () => {
    // Dispatch exit event for Corpan host to handle navigation
    window.dispatchEvent(new CustomEvent("corpan:exit"))
  }

  root.render(
    <React.StrictMode>
      <App hostApi={hostApi} onExit={handleExit} />
    </React.StrictMode>
  )

  return {
    unmount: () => {
      root.unmount()
    },
  }
}

// Register game with Corpan host
function registerGame() {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    id: GAME_ID,
    mount: (container, hostApi, initialState) => {
      const scope = globalThis as GlobalScope

      // Clean up previous instance
      if (scope.__juiceSqueeze2) {
        scope.__juiceSqueeze2.unmount()
        scope.__juiceSqueeze2 = undefined
      }

      const instance = mountGame(container, hostApi, initialState)
      scope.__juiceSqueeze2 = instance

      return {
        unmount: () => {
          instance.unmount()
          scope.__juiceSqueeze2 = undefined
        },
      }
    },
  }
}

registerGame()

// Standalone dev mode
if (import.meta.env.DEV && !((globalThis as GlobalScope).__corpanHostActive)) {
  const container = document.getElementById("root")
  if (container) {
    // Create mock host API
    const mockStackConfig: StackConfig = {
      activeStackId: "default",
      languages: ["es", "en"],
      domains: [],
      levels: ["A0", "A1", "A2"],
      rate: 1.0,
      textSize: "medium",
      showRomanization: true,
    }

    const mockPhrases = [
      { entry_id: 1, level: "A1", domains: [], translations: [
        { language_code: "en", text: "Hello, how are you?", romanization: "" },
        { language_code: "es", text: "Hola, ¿cómo estás?", romanization: "" },
      ]},
      { entry_id: 2, level: "A1", domains: [], translations: [
        { language_code: "en", text: "I am fine, thank you.", romanization: "" },
        { language_code: "es", text: "Estoy bien, gracias.", romanization: "" },
      ]},
      { entry_id: 3, level: "A2", domains: [], translations: [
        { language_code: "en", text: "Where is the train station?", romanization: "" },
        { language_code: "es", text: "¿Dónde está la estación de tren?", romanization: "" },
      ]},
      { entry_id: 4, level: "A1", domains: [], translations: [
        { language_code: "en", text: "Good morning!", romanization: "" },
        { language_code: "es", text: "¡Buenos días!", romanization: "" },
      ]},
      { entry_id: 5, level: "A2", domains: [], translations: [
        { language_code: "en", text: "I would like a coffee, please.", romanization: "" },
        { language_code: "es", text: "Me gustaría un café, por favor.", romanization: "" },
      ]},
    ]

    let phraseIndex = 0

    const mockHostApi: HostApi = {
      speak: async (lang, text) => {
        console.log(`[TTS] ${lang}: ${text}`)
        if ("speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.lang = lang
          window.speechSynthesis.speak(utterance)
        }
      },
      speakConcurrent: async (lang, text) => {
        console.log(`[TTS] ${lang}: ${text}`)
        if ("speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.lang = lang
          window.speechSynthesis.speak(utterance)
        }
      },
      stopSpeech: () => {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel()
        }
      },
      getStackConfig: () => mockStackConfig,
      onStackConfigChange: () => () => {},
      getRandomEntry: async () => {
        const phrase = mockPhrases[phraseIndex % mockPhrases.length]
        phraseIndex++
        return phrase
      },
      getRandomEntries: async (count) => {
        const results = []
        for (let i = 0; i < count; i++) {
          results.push(mockPhrases[(phraseIndex + i) % mockPhrases.length])
        }
        phraseIndex += count
        return results
      },
      getEntryById: async (id) => {
        return mockPhrases.find((p) => p.entry_id === id) || mockPhrases[0]
      },
      isMock: true,
    }

    mountGame(container, mockHostApi)
  }
}
