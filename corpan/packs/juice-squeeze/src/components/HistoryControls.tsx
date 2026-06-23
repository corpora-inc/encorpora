/**
 * HistoryControls — prev (←) / next (→) buttons for phrase history. Prev is
 * disabled at the start of history; next is always enabled (loads a fresh
 * phrase when at the end), matching shipped nav-arrow behavior. Horizontal
 * swipe is wired in JuiceSqueezeApp (left = next, right = prev).
 */
type Props = {
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
}

export function HistoryControls({ canPrev, canNext, onPrev, onNext }: Props) {
  return (
    <div className="jsf-nav">
      <button
        type="button"
        className="jsf-nav__btn"
        data-testid="prev"
        disabled={!canPrev}
        onClick={onPrev}
        title="Previous"
      >
        ←
      </button>
      <button
        type="button"
        className="jsf-nav__btn"
        data-testid="next"
        disabled={!canNext}
        onClick={onNext}
        title="Next"
      >
        →
      </button>
    </div>
  )
}
