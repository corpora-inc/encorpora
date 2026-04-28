import "./styles.css"
import type { GameModule, HostApi } from "@shared/sdk"
import { createMockHostApi } from "@shared/sdk"
import { createEarthgateReader } from "./game"
import { createAppShell, type ReaderFactory } from "@shared/catalog"
import manifest from "../manifest.json"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __earthgateReader?: { dispose: () => void }
  __corpanHostActive?: boolean
}

const GAME_ID = "earthgate_reader"

// Track the last mounted reader instance for language/bookmark callbacks
let lastReader: ReturnType<typeof createEarthgateReader> | null = null

const readerFactory: ReaderFactory = (container, hostApi, initialState) => {
  const reader = createEarthgateReader(container, hostApi as HostApi, initialState)
  lastReader = reader
  return reader
}

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

      const shell = createAppShell(container, {
        readerId: "earthgate",
        readerVersion: manifest.version,
        createReader: readerFactory,
        hostApi,
        initialState: state,
        onBeforeExit: () => {
          lastReader?.persistBookmark()
        },
      })
      scope.__earthgateReader = shell

      return {
        unmount: () => {
          shell.dispose()
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
