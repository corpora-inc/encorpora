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
      // `mountApp` is async: it probes the host for the native radio plugin
      // before deciding native vs WebView player. The host's `mount()`
      // contract is sync, so we kick off the mount and hand back an
      // unmount() that races the still-mounting app.
      let disposed = false
      let mounted: App | null = null
      void mountApp(
        container,
        hostApi,
        initialState as { stackConfig?: StackConfig } | undefined
      ).then((app) => {
        if (disposed) {
          app.dispose()
          return
        }
        mounted = app
        scope.__worldRadio = app
      }).catch((err) => {
        console.error("[world-radio] mountApp failed:", err)
      })
      return {
        unmount: () => {
          disposed = true
          mounted?.dispose()
          mounted = null
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
