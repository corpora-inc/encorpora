import { useGameStore } from "../store/gameState"

type TopBarProps = {
  onExit: () => void
}

export function TopBar({ onExit }: TopBarProps) {
  const stats = useGameStore((s) => s.stats)
  const bottleProgress = useGameStore((s) => s.bottleProgress)

  // Show last 6 bottles
  const recentBottles = bottleProgress.bottleCollection.slice(-6)

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <div className="score-display">
          <span className="score-value">{stats.allTimeScore}</span>
        </div>
        <div className="bottle-collection">
          {recentBottles.map((bottle) => (
            <div key={bottle.id} className="mini-bottle">
              <div className="mini-bottle-glass" />
              <div
                className="mini-bottle-liquid"
                style={{
                  background: bottle.gradient
                    ? `linear-gradient(to bottom, ${bottle.gradient[0]}, ${bottle.gradient[1]}, ${bottle.gradient[2]})`
                    : bottle.color,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="top-bar-center">
        <h1 className="game-title">Juice Squeeze</h1>
      </div>

      <button className="exit-btn" onClick={onExit} aria-label="Exit game">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  )
}
