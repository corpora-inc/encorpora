import { createRoot, type Root } from "react-dom/client"
import "./styles.css"
import type { GameModule, HostApi, StackConfig } from "./sdk/types"
import { createMockHostApi } from "./sdk/mockHostApi"
import { App } from "./App"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __kronopan?: { dispose: () => void }
  __corpanHostActive?: boolean
}

type InitialState = {
  stackConfig?: StackConfig
}

const GAME_ID = "kronopan"

const mountKronopan = (
  container: HTMLElement,
  hostApi: HostApi,
  _initialState?: InitialState,
): { dispose: () => void } => {
  const root: Root = createRoot(container)
  root.render(<App hostApi={hostApi} />)
  return {
    dispose: () => {
      root.unmount()
    },
  }
}

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      const s = globalThis as GlobalScope
      if (s.__kronopan) {
        s.__kronopan.dispose()
        s.__kronopan = undefined
      }
      const instance = mountKronopan(container, hostApi, initialState)
      s.__kronopan = instance
      return {
        unmount: () => {
          instance.dispose()
          s.__kronopan = undefined
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
  if (scope.__kronopan) {
    scope.__kronopan.dispose()
    scope.__kronopan = undefined
  }
  const mod = scope.CorpanGames?.[GAME_ID]
  if (!mod) {
    return
  }
  mod.mount(root, hostApi, { stackConfig: hostApi.getStackConfig() } as InitialState)
}

registerGame()
mountForDev()
