import { createRoot, type Root } from "react-dom/client"
import "./styles.css"
import type { GameModule, HostApi, StackConfig } from "./sdk/types"
import { createMockHostApi } from "./sdk/mockHostApi"
import { App } from "./App"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __beatlounge?: { dispose: () => void }
  __corpanHostActive?: boolean
}

type InitialState = { stackConfig?: StackConfig }

const GAME_ID = "beatlounge"

const mountBeatlounge = (
  container: HTMLElement,
  hostApi: HostApi,
  _initialState?: InitialState
): { dispose: () => void } => {
  const root: Root = createRoot(container)
  root.render(<App hostApi={hostApi} />)
  return { dispose: () => root.unmount() }
}

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})
  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      const s = globalThis as GlobalScope
      if (s.__beatlounge) {
        s.__beatlounge.dispose()
        s.__beatlounge = undefined
      }
      const instance = mountBeatlounge(container, hostApi, initialState)
      s.__beatlounge = instance
      return {
        unmount: () => {
          instance.dispose()
          s.__beatlounge = undefined
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
  const hostApi = createMockHostApi()
  if (scope.__beatlounge) {
    scope.__beatlounge.dispose()
    scope.__beatlounge = undefined
  }
  scope.CorpanGames?.[GAME_ID]?.mount(root, hostApi, {
    stackConfig: hostApi.getStackConfig(),
  })
}

registerGame()
mountForDev()
