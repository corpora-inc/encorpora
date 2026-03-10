import "./styles.css"
import type { GameModule, HostApi } from "@shared/sdk"
import { createMockHostApi } from "@shared/sdk"
import { createStargateReader } from "./game"
import { createAppShell, type ReaderFactory } from "@shared/catalog"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __stargateReader?: { dispose: () => void }
  __corpanHostActive?: boolean
}

const GAME_ID = "stargate_reader"

const readerFactory: ReaderFactory = (container, hostApi, initialState) =>
  createStargateReader(container, hostApi as HostApi, initialState)

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
      const contentRevision = scriptEl?.dataset.corpGameContentRevision

      const state = {
        ...(initialState as Record<string, unknown>),
        ...(baseUrl ? { baseUrl } : {}),
        ...(contentRevision ? { contentRevision } : {}),
      }

      const shell = createAppShell(container, {
        createReader: readerFactory,
        hostApi,
        initialState: state,
      })
      scope.__stargateReader = shell

      return {
        unmount: () => {
          shell.dispose()
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
