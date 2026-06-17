/**
 * Controls — fruit-flip (🍊), give-up/show-answer (👁), ear/listen (🎧), exit (✕).
 * Matches the shipped icon buttons and their semantics:
 *  - fruit: toggleFruits() — flips block text to fruit emoji and back.
 *  - give-up: reveal the answer overlay + speak it in blockLang.
 *  - ear: speak the correct answer on demand (no overlay).
 *  - exit: dispatch the corpan:exit window event.
 *
 * Layout: the action controls (fruit/ear/give-up) live in an in-flow slim row
 * placed by GameLayout JUST ABOVE the word bank, so they never overlap the
 * bank's word blocks. The exit ✕ stays absolute in the very top-right corner.
 */
import { useGameStore } from "../state/gameStore"

type Props = {
  onFruit: () => void
  onGiveUp: () => void
  onEar: () => void
}

/** Top-right exit button (absolute, top-right corner). */
export function ExitButton() {
  const exit = () => window.dispatchEvent(new CustomEvent("corpan:exit"))
  return (
    <button
      type="button"
      className="jsf-icon-btn jsf-exit"
      data-testid="exit"
      title="Exit"
      onClick={exit}
    >
      ✕
    </button>
  )
}

export function Controls({ onFruit, onGiveUp, onEar }: Props) {
  const fruitsEnabled = useGameStore((s) => s.settings.fruitsEnabled)

  return (
    <div className="jsf-controls-bar" data-testid="controls-bar">
      <button
        type="button"
        className={`jsf-icon-btn${fruitsEnabled ? " jsf-icon-btn--active" : ""}`}
        data-testid="fruit-flip"
        title="Flip to fruits"
        onClick={onFruit}
      >
        🍊
      </button>
      <button
        type="button"
        className="jsf-icon-btn"
        data-testid="ear"
        title="Listen to answer"
        onClick={onEar}
      >
        🎧
      </button>
      <button
        type="button"
        className="jsf-icon-btn"
        data-testid="give-up"
        title="Show answer"
        onClick={onGiveUp}
      >
        👁
      </button>
    </div>
  )
}
