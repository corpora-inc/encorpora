/**
 * CoinCounter — the header gold-coin tally (the meta-loop reward, separate from
 * the word score). Always rendered (even at 0) so the basket-carry coin overlay
 * always has a `[data-testid="coin-counter"]` landing target; the count pops when
 * it changes (key-remount re-triggers the CSS pop).
 */
import { useGameStore } from "../state/gameStore"

export function CoinCounter() {
  const coins = useGameStore((s) => s.stats.coins) || 0
  return (
    <div className="jsf-coins" data-testid="coin-counter" title="Coins">
      <span className="jsf-coins__icon" aria-hidden="true">★</span>
      <span key={coins} className="jsf-coins__count">
        {coins}
      </span>
    </div>
  )
}
