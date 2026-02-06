import { useGameStore } from "../store/gameState"

type ControlBarProps = {
  onPrev: () => void
  onNext: () => void
  onSpeak: () => void
  onShowAnswer: () => void
  onToggleFruit: () => void
  hasPrev: boolean
  hasNext: boolean
}

export function ControlBar({
  onPrev,
  onNext,
  onSpeak,
  onShowAnswer,
  onToggleFruit,
  hasPrev,
  hasNext,
}: ControlBarProps) {
  const fruitsEnabled = useGameStore((s) => s.settings.fruitsEnabled)

  return (
    <div className="control-bar">
      <div className="control-bar-left">
        <button
          className="nav-arrow prev-arrow"
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Previous phrase"
        >
          <span aria-hidden="true">&larr;</span>
        </button>
        <button
          className="nav-arrow next-arrow"
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Next phrase"
        >
          <span aria-hidden="true">&rarr;</span>
        </button>
        <button
          className={`icon-btn ${fruitsEnabled ? "active" : ""}`}
          onClick={onToggleFruit}
          aria-label="Toggle fruit mode"
        >
          <span aria-hidden="true">🍊</span>
        </button>
      </div>

      <div className="control-bar-right">
        <button
          className="icon-btn"
          onClick={onSpeak}
          aria-label="Speak phrase"
        >
          <span aria-hidden="true">👂</span>
        </button>
        <button
          className="icon-btn"
          onClick={onShowAnswer}
          aria-label="Show answer"
        >
          <span aria-hidden="true">👁️</span>
        </button>
      </div>
    </div>
  )
}
