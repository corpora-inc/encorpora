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

      // Landscape-first: let the FIT canvas use the full container. On phone aspect
      // ratios FIT's letterbox bars already keep content clear of the notch / home
      // indicator, so we don't pad the container (padding over-shrinks the view,
      // especially the notch side in landscape).
      const prevStyle = container.getAttribute("style")
      container.style.background = "#0f0f23"
      container.style.overflow = "hidden"
      container.style.touchAction = "none" // touches drive the game, not page scroll/zoom

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

      // Belt-and-suspenders: ensure the canvas itself ignores native touch gestures.
      game.events.once(Phaser.Core.Events.READY, () => {
        const c = game.canvas
        if (c) c.style.touchAction = "none"
      })

      // Re-fit on resize / orientation change — webviews don't always refit FIT
      // mode on their own (rotating landscape↔portrait otherwise crowds the view).
      let raf = 0
      let to = 0
      const refit = () => {
        try {
          game.scale.refresh()
        } catch {
          /* game may be mid-teardown */
        }
      }
      const schedule = () => {
        if (raf) cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => {
          raf = 0
          refit()
        })
        if (to) clearTimeout(to)
        to = window.setTimeout(refit, 250) as unknown as number
      }
      const screenOrientation = window.screen?.orientation
      const vv = window.visualViewport
      window.addEventListener("resize", schedule)
      window.addEventListener("orientationchange", schedule)
      screenOrientation?.addEventListener?.("change", schedule)
      vv?.addEventListener?.("resize", schedule)
      vv?.addEventListener?.("scroll", schedule)

      const instance = {
        dispose: () => {
          window.removeEventListener("resize", schedule)
          window.removeEventListener("orientationchange", schedule)
          screenOrientation?.removeEventListener?.("change", schedule)
          vv?.removeEventListener?.("resize", schedule)
          vv?.removeEventListener?.("scroll", schedule)
          if (raf) cancelAnimationFrame(raf)
          if (to) clearTimeout(to)
          game.destroy(true)
          ;(globalThis as any).__questEarHostApi = undefined
          if (prevStyle === null) container.removeAttribute("style")
          else container.setAttribute("style", prevStyle)
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
