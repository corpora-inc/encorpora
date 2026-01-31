import "./styles.css"
import type { GameModule, HostApi, StackConfig } from "./sdk/types"
import { createTtsSequencer } from "./sequencer"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __ttsSequencer?: { dispose: () => void }
  __corpanHostActive?: boolean
}

type InitialState = {
  stackConfig?: StackConfig
}

const GAME_ID = "tts_sequencer"

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      const scope = globalThis as GlobalScope
      if (scope.__ttsSequencer) {
        scope.__ttsSequencer.dispose()
        scope.__ttsSequencer = undefined
      }
      const instance = createTtsSequencer(container, hostApi as HostApi, initialState as InitialState)
      scope.__ttsSequencer = instance
      return {
        unmount: () => {
          instance.dispose()
          scope.__ttsSequencer = undefined
        },
      }
    },
  }
}

registerGame()
