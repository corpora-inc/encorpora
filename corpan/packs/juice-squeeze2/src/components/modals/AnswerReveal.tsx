import { motion } from "framer-motion"
import { useGameStore } from "../../store/gameState"

type AnswerRevealProps = {
  onClose: () => void
}

export function AnswerReveal({ onClose }: AnswerRevealProps) {
  const phrase = useGameStore((s) => s.phrase)

  const correctAnswer = phrase.correctWords.join(" ")

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-content"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="answer-icon">
          <span role="img" aria-label="checkmark">✓</span>
        </div>
        <div className="answer-text">{correctAnswer}</div>
        <div className="modal-buttons">
          <button className="modal-btn primary" onClick={onClose}>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
