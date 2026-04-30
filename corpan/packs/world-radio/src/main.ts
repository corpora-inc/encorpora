import "./styles.css"
import type { GameModule, HostApi, StackConfig } from "./sdk/types"
import { createMockHostApi } from "./sdk/mockHostApi"
import { mountApp, type App } from "./app"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __worldRadio?: App
  __corpanHostActive?: boolean
}

const GAME_ID = "world_radio"

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      const scope = globalThis as GlobalScope
      if (scope.__worldRadio) {
        scope.__worldRadio.dispose()
        scope.__worldRadio = undefined
      }
      const app = mountApp(
        container,
        hostApi,
        initialState as { stackConfig?: StackConfig } | undefined
      )
      scope.__worldRadio = app
      return {
        unmount: () => {
          app.dispose()
          scope.__worldRadio = undefined
        },
      }
    },
  }
}

const mountForDev = () => {
  const scope = globalThis as GlobalScope
  if (scope.__corpanHostActive) return

  const root = document.getElementById("corpan-game-root")
  if (!root) return

  const hostApi: HostApi = createMockHostApi()
  if (scope.__worldRadio) {
    scope.__worldRadio.dispose()
    scope.__worldRadio = undefined
  }

  const module = scope.CorpanGames?.[GAME_ID]
  if (!module) return
  module.mount(root, hostApi, { stackConfig: hostApi.getStackConfig() })
}

registerGame()
mountForDev()
