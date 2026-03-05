import "./styles.css"
import type { GameModule, HostApi } from "./sdk/types"
import { createMockHostApi } from "./sdk/mockHostApi"
import { createEarthgateReader } from "./game"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __earthgateReader?: { dispose: () => void }
  __corpanHostActive?: boolean
}

const GAME_ID = "earthgate_reader"

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      const scope = globalThis as GlobalScope

      if (scope.__earthgateReader) {
        scope.__earthgateReader.dispose()
        scope.__earthgateReader = undefined
      }

      // Read baseUrl from the host-injected script tag
      const scriptEl = document.querySelector(
        `script[data-corp-game-id="${GAME_ID}"]`
      ) as HTMLScriptElement | null
      const baseUrl = scriptEl?.dataset.corpGameBaseUrl
      const contentRevision = scriptEl?.dataset.corpGameContentRevision

      const state = {
        ...(initialState as Record<string, unknown>),
        ...(baseUrl ? { baseUrl } : {}),
        ...(contentRevision ? { contentRevision } : {}),
      }

      const instance = createEarthgateReader(
        container,
        hostApi,
        state
      )
      scope.__earthgateReader = instance

      return {
        unmount: () => {
          instance.dispose()
          scope.__earthgateReader = undefined
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

  if (scope.__earthgateReader) {
    scope.__earthgateReader.dispose()
    scope.__earthgateReader = undefined
  }

  const module = scope.CorpanGames?.[GAME_ID]
  if (!module) {
    return
  }
  module.mount(root, hostApi)

  // Dev mode: handle corpan:exit by disposing the game
  window.addEventListener("corpan:exit", () => {
    if (scope.__earthgateReader) {
      scope.__earthgateReader.dispose()
      scope.__earthgateReader = undefined
    }
  })
}

registerGame()
mountForDev()
