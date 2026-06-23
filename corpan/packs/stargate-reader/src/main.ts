import "./styles.css"
import type { GameModule, HostApi } from "@shared/sdk"
import { createMockHostApi } from "@shared/sdk"
import { createStargateReader } from "./game"
import { createAppShell, type ReaderFactory } from "@shared/catalog"
import type { DrawerSectionDef } from "@shared/ui"

// Injected at build time via vite `define` — see vite.config.ts. We do NOT
// `import manifest from "../manifest.json"` because that puts the manifest
// in vite's watch graph and `dev-corpan.mjs` mutates it (devRevision bump),
// triggering infinite rebuild loops in dev mode.
declare const __STARGATE_READER_VERSION__: string

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __stargateReader?: { dispose: () => void }
  __corpanHostActive?: boolean
}

const GAME_ID = "stargate_reader"

// Track the last mounted reader instance for language/settings callbacks
let lastReader: ReturnType<typeof createStargateReader> | null = null

// The display section def — render is deferred until the reader provides its callbacks.
// The drawer calls render() during construction (before the reader mounts), so we stash
// the container and render into it once the reader is ready.
let pendingDisplayRender: ((container: HTMLElement) => void) | null = null
let displayContainer: HTMLElement | null = null

const displaySection: DrawerSectionDef = {
  id: "display",
  title: "Display",
  priority: 40,
  render: (container) => {
    displayContainer = container
    if (pendingDisplayRender) {
      pendingDisplayRender(container)
    }
  },
}

const readerFactory: ReaderFactory = (container, hostApi, initialState) => {
  const reader = createStargateReader(container, hostApi as HostApi, initialState)
  lastReader = reader

  // Get the display section from the reader (has live callbacks to 3D objects)
  const readerSection = reader.getDisplaySection()
  pendingDisplayRender = readerSection.render

  // If the drawer already rendered the section container before the reader was ready, fill it now
  if (displayContainer) {
    displayContainer.innerHTML = ""
    pendingDisplayRender(displayContainer)
  }

  return reader
}

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
        readerId: "stargate",
        readerVersion: __STARGATE_READER_VERSION__,
        createReader: readerFactory,
        hostApi,
        initialState: state,
        customSections: [displaySection],
        onBeforeExit: () => {
          lastReader?.persistBookmark()
        },
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
