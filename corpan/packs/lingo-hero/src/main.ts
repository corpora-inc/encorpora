import "./styles.css"
import type { GameModule, HostApi } from "./sdk/types"
import { createMockHostApi } from "./sdk/mockHostApi"
import { Game } from "./Game"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __lingoHero?: { dispose: () => void }
  __corpanHostActive?: boolean
}

// Pack id MUST be the underscore form. The installer derives the pack id from
// the zip filename and normalizes hyphens to underscores (see install.ts), so
// the game must register under — and the manifest id must be — `lingo_hero`,
// else install fails with "Pack id mismatch". Paths/zip stay hyphenated.
const GAME_ID = "lingo_hero"

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
      
      const instance = new Game(container, hostApi, initialState)

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
