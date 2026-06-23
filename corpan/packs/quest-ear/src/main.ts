import "./styles.css"
import Phaser from "phaser"
import type { GameModule, HostApi, StackConfig } from "./sdk/types"
import { MainScene } from "./game/MainScene"
import { ActionScene } from "./game/ActionScene"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __questEar?: { dispose: () => void }
  __corpanHostActive?: boolean
}

type InitialState = {
  stackConfig?: StackConfig
}

const GAME_ID = "quest_ear"

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      const scope = globalThis as GlobalScope

      if (scope.__questEar) {
        scope.__questEar.dispose()
        scope.__questEar = undefined
      }

      // Store hostApi globally for Phaser scenes to access
      ;(globalThis as any).__questEarHostApi = hostApi

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: container,
        backgroundColor: "#0f0f23",
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
          },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: [MainScene, ActionScene],
      }

      const game = new Phaser.Game(config)

      const instance = {
        dispose: () => {
          game.destroy(true)
          ;(globalThis as any).__questEarHostApi = undefined
        },
      }

      scope.__questEar = instance
      return {
        unmount: () => {
          instance.dispose()
          scope.__questEar = undefined
        },
      }
    },
  }
}

registerGame()
// NO mountForDev — game only runs inside Corpán
