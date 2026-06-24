import "./styles.css"
import type { GameModule, HostApi } from "./sdk/types"
import { createMockHostApi } from "./sdk/mockHostApi"
import { Game } from "./Game"
import type { Note, ActiveLanguage, GameMode } from "./types"
import type { LaneSystem } from "./LaneSystem"
import type { Round } from "./ContentManager"
import type { Hud } from "./ui/Hud"

/**
 * DEBUG / INTROSPECTION CONTRACT — not a public API.
 *
 * At runtime `window.__lingoHero` is the FULL `Game` instance, but the e2e
 * harness (`test/e2e/gameplay.spec.mjs`) only ever pokes at a known subset of
 * its members — including several that are `private` on `Game` (TS `private`
 * is erased at runtime, so JS can still read them). This interface is the
 * EXPLICIT, TYPED list of exactly what the harness is allowed to touch, so a
 * future content-mangler can't hide behind a too-loose `{ dispose }` type
 * (which is precisely how the #460 cleanPrompt comma-truncation slipped past
 * five rounds of tests — they reached past `{dispose}` into untyped internals).
 *
 * Members are pulled from `Game` via index access so the contract stays in
 * lock-step with the real implementation: if a method's signature changes, the
 * harness call typechecks against the real thing, not a hand-copied shadow.
 * Keep this in sync with what the harness reads off `window.__lingoHero`.
 */
export interface LingoHeroDebug {
  // Lifecycle
  dispose: Game["dispose"]
  /** GameMode is a string enum; the harness passes string-literal modes. */
  startGame: (mode: GameMode | `${GameMode}`) => void
  resume: Game["resume"]

  // The real prompt-cleaning path (#460 comma-truncation regression surface).
  cleanPrompt: (text: string) => string

  // Live gameplay state the harness asserts on.
  readonly score: number
  readonly combo: number
  readonly notes: Note[]
  readonly caughtCount: number
  readonly decoyDodges: number
  readonly round: Round | null
  readonly activeLanguage: ActiveLanguage

  // Subsystems the harness introspects (lane geometry, canvas rect, HUD).
  readonly laneSystem: LaneSystem
  readonly canvas: HTMLCanvasElement
  readonly hud: Pick<Hud, "setQuestion">

  // iOS audio-unlock diagnostics (#428).
  audioContextState: Game["audioContextState"]
  audioUnlocked: Game["audioUnlocked"]
}

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __lingoHero?: LingoHeroDebug
  __corpanHostActive?: boolean
}

// Pack id MUST be the underscore form. The installer derives the pack id from
// the zip filename and normalizes hyphens to underscores (see install.ts), so
// the game must register under — and the manifest id must be — `lingo_hero`,
// else install fails with "Pack id mismatch". Paths/zip stay hyphenated.
const GAME_ID = "lingo_hero"

/**
 * Expose a `Game` as the debug surface. `LingoHeroDebug` intentionally names
 * `private` members of `Game` (which TS won't accept as a structural
 * assignment), so this is the ONE sanctioned cast — narrowing the full
 * instance to the typed introspection contract above.
 */
const asDebug = (game: Game): LingoHeroDebug =>
  game as unknown as LingoHeroDebug

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

      scope.__lingoHero = asDebug(instance)
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
  scope.__lingoHero = asDebug(instance)
}

registerGame()
mountForDev()
