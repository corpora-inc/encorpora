import "./styles.css"
import type { GameModule, HostApi, StackConfig } from "./sdk/types"
import { createMockHostApi } from "./sdk/mockHostApi"
import { Game } from "./Game"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __lingoHero?: { dispose: () => void }
  __corpanHostActive?: boolean
}

type InitialState = {
  stackConfig?: StackConfig
}

const GAME_ID = "lingo-hero"

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      const scope = globalThis as GlobalScope
      if (scope.__lingoHero) {
        scope.__lingoHero.dispose()
        scope.__lingoHero = undefined
      }
      
      const instance = new Game(container, hostApi)
      
      scope.__lingoHero = instance
      return {
        unmount: () => {
          instance.dispose()
          scope.__lingoHero = undefined
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

  // Create dev container
  let root = document.getElementById("lingo-hero-root")
  if (!root) {
    root = document.createElement("div")
    root.id = "lingo-hero-root"
    document.body.appendChild(root)
  }

  const hostApi: HostApi = createMockHostApi()
  
  if (scope.__lingoHero) {
    scope.__lingoHero.dispose()
  }

  const instance = new Game(root, hostApi)
  scope.__lingoHero = instance
}

registerGame()
mountForDev()
