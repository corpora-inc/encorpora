import { createRoot, type Root } from "react-dom/client"
import "./styles.css"
import type { GameModule, HostApi, StackConfig } from "./sdk/types"
import { createMockHostApi } from "./sdk/mockHostApi"
import { makeDeferredUnmount } from "./modules/_shared/deferUnmount"
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
  // Deferred + once-only: never call root.unmount() synchronously during a
  // React render/commit (host teardown can fire mid-render → detached DOM →
  // NotFoundError → black screen). The actual unmount runs on a microtask.
  return { dispose: makeDeferredUnmount(root) }
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
