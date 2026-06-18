/**
 * HeroVessel — the full-screen juice BACKGROUND. Owns the LiquidController
 * lifecycle (Pixi runs its own ticker; React never drives liquid frames).
 *
 * It mounts a transparent, pointer-events:none Pixi canvas as a FIXED
 * full-viewport layer (inset:0, z-index:0) BEHIND all the DOM UI — the liquid
 * fills the whole screen from the bottom up. The controller is exposed to the
 * game via an imperative ref/callback so useGameLogic can call triggerWin /
 * triggerBottleComplete without re-rendering React.
 *
 * COLOR is pushed imperatively whenever the current fruit changes (a thin store
 * subscription, NOT a per-frame React render). The FILL is NOT subscribed here:
 * the pour/fill-to-full/reset-to-empty choreography is driven explicitly by
 * useGameLogic via the controller ref so it can sequence full→celebrate→reset
 * (a store-fill subscription would drain the glass instantly on bottle-complete,
 * since recordCompletedPhrase resets phrasesInCurrentBottle to 0). We only set
 * the INITIAL fill on mount; every later fill change comes from useGameLogic.
 */
import { useEffect, useRef } from "react"
import { useGameStore } from "../state/gameStore"
import { getAllFruits } from "../state/fruits"
import { createLiquidController, type LiquidController } from "../liquid/LiquidController"

type Props = {
  /** Receives the controller once mounted so the game can drive win effects. */
  onReady?: (controller: LiquidController) => void
}

function currentGradient(): [string, string, string] {
  const idx = useGameStore.getState().bottleProgress.currentColorIndex
  const fruits = getAllFruits()
  const fruit = fruits[((idx % fruits.length) + fruits.length) % fruits.length]
  return fruit.gradient
}

export function HeroVessel({ onReady }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const ctrlRef = useRef<LiquidController | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const ctrl = createLiquidController()
    ctrlRef.current = ctrl
    ctrl.mount(host)

    // Initial paint from current store state.
    ctrl.setColor(currentGradient())
    ctrl.setFill(useGameStore.getState().getBottleFillPercent() / 100, { animate: false })

    onReady?.(ctrl)

    // Imperative store subscription: push COLOR on change only. The FILL is
    // driven explicitly by useGameLogic (pour / fill-to-full / reset-to-empty)
    // so the bottle-complete sequence can hold the glass full before resetting.
    let lastColorIdx = useGameStore.getState().bottleProgress.currentColorIndex
    const unsub = useGameStore.subscribe((s) => {
      const colorIdx = s.bottleProgress.currentColorIndex
      if (colorIdx !== lastColorIdx) {
        lastColorIdx = colorIdx
        ctrl.setColor(currentGradient())
      }
    })

    const onResize = () => ctrl.resize()
    window.addEventListener("resize", onResize)

    // CRITICAL: the Pixi canvas can init before `host` has layout dimensions
    // (its size is 0 at first paint), which renders the liquid into a ~1×1 space
    // (invisible). A ResizeObserver fires once the real size is laid out AND on
    // every later size change, calling ctrl.resize() so the canvas always
    // matches the screen. This is what makes the juice actually appear.
    const ro = new ResizeObserver(() => ctrl.resize())
    ro.observe(host)

    return () => {
      unsub()
      window.removeEventListener("resize", onResize)
      ro.disconnect()
      ctrl.dispose()
      ctrlRef.current = null
    }
    // onReady is stable from the parent (useCallback); intentionally run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className="jsf-hero" ref={hostRef} data-testid="hero-vessel" aria-hidden="true" />
}
