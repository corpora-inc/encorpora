import "./styles.css"
import type { GameModule, HostApi, StackConfig } from "./sdk/types"
import { mountParlometron } from "./parlometron"
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

// Catalog ID stays `pronunciation_coach` so old Corpán installs that
// look up this pack by ID keep working. User-facing brand is
// "Parlometron" (see manifest.json `name`).
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

      // mountParlometron renders the mode picker first; from there
      // the user picks Practice (the original solo flow) or Play
      // with Friends (the new multiplayer mode).
      const handle = mountParlometron(container, hostApi)

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
