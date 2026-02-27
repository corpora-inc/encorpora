import "./styles.css"
import type { GameModule, HostApi } from "./sdk/types"
import { createMockHostApi } from "./sdk/mockHostApi"
import { createStargateReader } from "./game"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __stargateReader?: { dispose: () => void }
  __corpanHostActive?: boolean
}

const GAME_ID = "stargate_reader"

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      const scope = globalThis as GlobalScope

      if (scope.__stargateReader) {
        scope.__stargateReader.dispose()
        scope.__stargateReader = undefined
      }

      // Read baseUrl from the host-injected script tag
      const scriptEl = document.querySelector(
        `script[data-corp-game-id="${GAME_ID}"]`
      ) as HTMLScriptElement | null
      const baseUrl = scriptEl?.dataset.corpGameBaseUrl

      const state = {
        ...(initialState as Record<string, unknown>),
        ...(baseUrl ? { baseUrl } : {}),
      }

      const instance = createStargateReader(
        container,
        hostApi,
        state
      )
      scope.__stargateReader = instance

      return {
        unmount: () => {
          instance.dispose()
          scope.__stargateReader = undefined
        },
      }
    },
  }
}

const mountForDev = () => {
  const scope = globalThis as GlobalScope

  if (scope.__corpanHostActive) {
    return
  }

  const root = document.getElementById("corpan-game-root")
  if (!root) {
    return
  }

  const hostApi: HostApi = createMockHostApi()

  if (scope.__stargateReader) {
    scope.__stargateReader.dispose()
    scope.__stargateReader = undefined
  }

  const module = scope.CorpanGames?.[GAME_ID]
  if (!module) {
    return
  }
  module.mount(root, hostApi)

  // Dev mode: handle corpan:exit by disposing the game
  window.addEventListener("corpan:exit", () => {
    if (scope.__stargateReader) {
      scope.__stargateReader.dispose()
      scope.__stargateReader = undefined
    }
  })
}

registerGame()
mountForDev()
