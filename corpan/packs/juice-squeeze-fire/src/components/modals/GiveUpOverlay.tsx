/**
 * GiveUpOverlay — the show-answer overlay. Reveals the correct sentence
 * (joined via joinForTTS) so the player can peek, then closes back to the SAME
 * phrase to keep building it (it does NOT jump to a new phrase — Ian's note).
 * Both the button and the backdrop close-and-stay. The eye reveal is SILENT;
 * the headphone (ear) button is the audio-only path. See useGameLogic.
 */
type Props = {
  text: string
  onClose: (advance: boolean) => void
}

export function GiveUpOverlay({ text, onClose }: Props) {
  return (
    <div
      className="jsf-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(false)
      }}
    >
      <div className="jsf-answer">
        <div className="jsf-answer__icon">✓</div>
        <div className="jsf-answer__text" data-testid="answer-text">
          {text}
        </div>
        <button
          type="button"
          className="jsf-btn jsf-btn--primary"
          title="Keep playing"
          data-testid="giveup-close"
          onClick={() => onClose(false)}
        >
          Keep playing
        </button>
      </div>
    </div>
  )
}
