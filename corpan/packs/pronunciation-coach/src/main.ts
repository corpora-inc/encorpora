import "./styles.css"
import type { GameModule, HostApi, StackConfig } from "./sdk/types"
import { mountGame } from "./game"
// Canonical devConsole lives in `packs/sdk/devConsole.ts` so any pack
// can opt-in with a single import. Forwards pack-side console.* to a
// dev HTTP receiver on :8990 (see corpan/DEV_LOOP.md). No-op in
// production builds (only activates on http://lan-ip dev manifests).
import { installDevConsoleForwarder } from "../../sdk/devConsole"

installDevConsoleForwarder()

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __pronunciationCoach?: { dispose: () => void }
}

type InitialState = {
  stackConfig?: StackConfig
}

const GAME_ID = "pronunciation_coach"

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (
      container: HTMLElement,
      hostApi: HostApi,
      _initialState?: InitialState
    ) => {
      const scope = globalThis as GlobalScope

      if (scope.__pronunciationCoach) {
        scope.__pronunciationCoach.dispose()
        scope.__pronunciationCoach = undefined
      }

      const handle = mountGame(container, hostApi)

      const instance = {
        dispose: () => {
          handle.unmount()
        },
      }

      scope.__pronunciationCoach = instance
      return {
        unmount: () => {
          instance.dispose()
          scope.__pronunciationCoach = undefined
        },
      }
    },
  }
}

registerGame()
// NO mountForDev — pack only runs inside Corpán
