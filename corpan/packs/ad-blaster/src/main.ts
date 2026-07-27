import "./styles.css"
import type { GameModule, HostApi, StackConfig } from "./sdk/types"
import { createMockHostApi } from "./sdk/mockHostApi"
import { createAdBlaster } from "./game"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __adBlaster?: { dispose: () => void }
  __corpanHostActive?: boolean
}

type InitialState = {
  stackConfig?: StackConfig
}

const GAME_ID = "ad_blaster"

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      const scope = globalThis as GlobalScope
      if (scope.__adBlaster) {
        scope.__adBlaster.dispose()
        scope.__adBlaster = undefined
      }
      const instance = createAdBlaster(container, hostApi, initialState)
      scope.__adBlaster = instance
      return {
        unmount: () => {
          instance.dispose()
          scope.__adBlaster = undefined
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
  if (scope.__adBlaster) {
    scope.__adBlaster.dispose()
    scope.__adBlaster = undefined
  }
  const module = scope.CorpanGames?.[GAME_ID]
  if (!module) {
    return
  }
  module.mount(root, hostApi, { stackConfig: hostApi.getStackConfig() } as InitialState)
}

registerGame()
mountForDev()
