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

      // Synchronously cancel any prior instance attached to this container,
      // even if its mountApp() is still in flight. We track the cancel
      // function on the container itself so a second mount() call (before
      // the first one resolved) can find it — `scope.__worldRadio` only
      // gets set after the promise resolves, so it can't be relied on here
      // to detect an in-flight predecessor. Without this guard, two
      // mountApp() calls append two copies of the entire UI to the same
      // container, producing a duplicated "Your stack / All languages"
      // and other ghost UI.
      type PackContainer = HTMLElement & { __wrAbort?: () => void }
      const c = container as PackContainer
      c.__wrAbort?.()
      container.replaceChildren()
      container.classList.remove("wr-root", "has-player", "is-scrolled", "is-mapview")

      // `mountApp` is async: it probes the host for the native radio plugin
      // before deciding native vs WebView player. The host's `mount()`
      // contract is sync, so we kick off the mount and hand back an
      // unmount() that races the still-mounting app.
      let aborted = false
      let mounted: App | null = null

      const abort = () => {
        aborted = true
        mounted?.dispose()
        mounted = null
        if (c.__wrAbort === abort) {
          delete c.__wrAbort
        }
      }
      c.__wrAbort = abort

      void mountApp(
        container,
        hostApi,
        initialState as { stackConfig?: StackConfig } | undefined
      ).then((app) => {
        if (aborted) {
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
          abort()
          if (scope.__worldRadio === mounted) {
            scope.__worldRadio = undefined
          }
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
