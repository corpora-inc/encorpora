/**
 * ScoreBar — the persistent all-time score (stats.allTimeScore), shown like the
 * shipped juice-glass label.
 */
import { useGameStore } from "../state/gameStore"

export function ScoreBar() {
  const score = useGameStore((s) => s.stats.allTimeScore)
  return (
    <div className="jsf-score" data-testid="score">
      <span className="jsf-score__badge" aria-hidden="true">
        <span className="jsf-score__star">★</span>
      </span>
      <span className="jsf-score__value">{score ?? 0}</span>
    </div>
  )
}
