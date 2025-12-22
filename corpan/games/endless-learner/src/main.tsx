import { createRoot } from "react-dom/client"
import { App } from "./App"
import { createMockHostApi } from "./sdk/mockHostApi"
import type { GameModule, HostApi, StackConfig } from "./sdk/types"
import { createRuntime } from "./runtime"
import "./styles.css"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __endlessLearner?: { dispose: () => void }
}

type InitialState = {
  stackConfig?: StackConfig
}

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry["endless_learner"] = {
    mount: (container, hostApi, initialState) => {
      const scope = globalThis as GlobalScope
      if (scope.__endlessLearner) {
        scope.__endlessLearner.dispose()
      }
      const root = createRoot(container)
      let disposed = false
      const runtime = createRuntime()
      root.render(
        <App
          hostApi={hostApi}
          initialStack={initialState?.stackConfig}
          runtime={runtime}
        />
      )
      const dispose = () => {
        if (disposed) {
          return
        }
        disposed = true
        runtime.stop()
        hostApi.stopSpeech?.()
        root.unmount()
      }
      scope.__endlessLearner = { dispose }
      return {
        unmount: dispose,
      }
    },
  }
}

const mountForDev = () => {
  const root = document.getElementById("corpan-game-root")
  if (!root) {
    return
  }

  const hostApi: HostApi = createMockHostApi()
  const scope = globalThis as GlobalScope
  if (scope.__endlessLearner) {
    scope.__endlessLearner.dispose()
  }
  const module = scope.CorpanGames?.["endless_learner"]
  if (!module) {
    return
  }
  module.mount(root, hostApi, { stackConfig: hostApi.getStackConfig() })
}

registerGame()
mountForDev()
