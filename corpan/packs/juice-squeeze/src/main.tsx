// Pack entry point. Registers the game with the Corpán host and mounts a
// React root into the host-provided container.
//
// NOTE: installDevConsoleForwarder() must run synchronously at module load,
// while document.currentScript is still valid (it reads the dev base URL from
// the injected script's dataset). Keep this import + call first.
import { installDevConsoleForwarder } from "../../sdk/devConsole"
installDevConsoleForwarder()

import "./styles.css"
import { StrictMode } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { GameModule, HostApi, StackConfig } from "./sdk/types"
import { JuiceSqueezeApp } from "./app/JuiceSqueezeApp"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __juiceSqueezeFire?: { dispose: () => void }
}

const GAME_ID = "juice_squeeze"

const mountGame = (
  container: HTMLElement,
  hostApi: HostApi,
  initialState?: { stackConfig?: StackConfig }
) => {
  const root: Root = createRoot(container)
  root.render(
    <StrictMode>
      <JuiceSqueezeApp hostApi={hostApi} initialStackConfig={initialState?.stackConfig} />
    </StrictMode>
  )
  return {
    dispose: () => {
      // Defer unmount out of the React commit phase to avoid the
      // "synchronously unmounted while rendering" warning on fast exits.
      queueMicrotask(() => root.unmount())
    },
  }
}

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      const scope = globalThis as GlobalScope
      if (scope.__juiceSqueezeFire) {
        scope.__juiceSqueezeFire.dispose()
        scope.__juiceSqueezeFire = undefined
      }
      const instance = mountGame(container, hostApi, initialState)
      scope.__juiceSqueezeFire = instance
      return {
        unmount: () => {
          instance.dispose()
          scope.__juiceSqueezeFire = undefined
        },
      }
    },
  }
}

registerGame()
