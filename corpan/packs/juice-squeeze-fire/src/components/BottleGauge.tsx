/**
 * BottleGauge — the current-fruit indicator in the header. The full-screen jar
 * IS the bottle fill now, so this is just the current fruit (a bit bigger, with
 * a gentle bob) rather than a redundant mini-bottle (Ian's call). It cycles with
 * the bottle color.
 */
import { useGameStore } from "../state/gameStore"
import { getAllFruits } from "../state/fruits"

export function BottleGauge() {
  const colorIdx = useGameStore((s) => s.bottleProgress.currentColorIndex)
  const fruits = getAllFruits()
  const fruit = fruits[((colorIdx % fruits.length) + fruits.length) % fruits.length]

  return (
    <div className="jsf-gauge" data-testid="bottle-gauge" aria-label={`Current fruit ${fruit.level}`}>
      <div className="jsf-gauge__fruit">{fruit.fruit}</div>
    </div>
  )
}
