/**
 * BottleGauge — the current-fruit indicator in the header. The full-screen jar
 * IS the bottle fill now, so this is just the current fruit (a bit bigger, with
 * a gentle bob) rather than a redundant mini-bottle (Ian's call). It cycles with
 * the bottle color.
 */
import type { CSSProperties } from "react"
import { useGameStore } from "../state/gameStore"
import { getAllFruits } from "../state/fruits"

export function BottleGauge() {
  const colorIdx = useGameStore((s) => s.bottleProgress.currentColorIndex)
  const fruits = getAllFruits()
  const fruit = fruits[((colorIdx % fruits.length) + fruits.length) % fruits.length]

  // Tint the glass disc to the current fruit so the header clearly reads
  // "this is the juice you're filling now". The fruit's own gradient drives a
  // soft inner glow + ring; logic/emoji are unchanged.
  const tintVars = {
    "--jsf-gauge-tint": fruit.primary,
    "--jsf-gauge-tint-lo": fruit.gradient[0],
    "--jsf-gauge-tint-hi": fruit.gradient[2],
  } as CSSProperties

  return (
    <div className="jsf-gauge" data-testid="bottle-gauge" aria-label={`Current fruit ${fruit.level}`}>
      <div className="jsf-gauge__fruit" style={tintVars}>
        <span className="jsf-gauge__ring" aria-hidden="true" />
        <span className="jsf-gauge__glow" aria-hidden="true" />
        <span className="jsf-gauge__emoji">{fruit.fruit}</span>
      </div>
    </div>
  )
}
