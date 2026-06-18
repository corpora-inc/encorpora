/**
 * BottleCollection — the last few completed bottles as small CAPPED-JAR icons
 * (Ian's jar idea): each jar is a lid on top + a body filled with that bottle's
 * stored fruit gradient (falls back to the level's gradient for older bottles).
 * The jar-fly celebration (see jarFly.ts) flies a matching jar UP into here, so
 * the flown jar visually "joins" these. Shows the last 6 with a "+N" overflow
 * chip (mirrors shipped renderBottleCollection, game.ts ~1805).
 */
import { useGameStore } from "../state/gameStore"
import { LEVEL_FRUIT_COLORS } from "../state/fruits"

export function BottleCollection() {
  const bottles = useGameStore((s) => s.bottleProgress.bottleCollection)
  const visible = bottles.slice(-6)
  const hidden = bottles.length - visible.length

  if (bottles.length === 0) return <div className="jsf-collection" data-testid="bottle-collection" />

  return (
    <div className="jsf-collection" data-testid="bottle-collection">
      {visible.map((b) => {
        const grad = b.gradient || LEVEL_FRUIT_COLORS[b.level].gradient
        return (
          <div key={b.id} className="jsf-jar-icon" title={b.level}>
            <div className="jsf-jar-icon__lid">
              <span className="jsf-jar-icon__band" />
            </div>
            <div className="jsf-jar-icon__body">
              <span
                className="jsf-jar-icon__fill"
                style={{
                  background: `linear-gradient(180deg, ${grad[0]} 0%, ${grad[1]} 52%, ${grad[2]} 100%)`,
                }}
              />
              <span className="jsf-jar-icon__shine" />
            </div>
          </div>
        )
      })}
      {hidden > 0 && <div className="jsf-collection__overflow">+{hidden}</div>}
    </div>
  )
}
