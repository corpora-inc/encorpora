import { motion } from "framer-motion"
import { type CollectedBottle } from "../../store/gameState"
import { t } from "../../utils/translations"

type PhraseReviewProps = {
  bottle: CollectedBottle
  onClose: () => void
  blockLang: string
}

export function PhraseReview({ bottle, onClose, blockLang }: PhraseReviewProps) {
  const phrases = bottle.phrases || []

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
        style={{ maxWidth: "min(90vw, 500px)" }}
      >
        <h2 style={{ color: "#FFD700", marginBottom: 16 }}>
          {t("phrasesCompleted", blockLang)}
        </h2>

        <div className="phrase-review-list">
          {phrases.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.5)", padding: 20 }}>
              {t("noPhrases", blockLang)}
            </div>
          ) : (
            phrases.map((phrase, i) => (
              <div key={phrase.id || i} className="review-phrase-item">
                <div className="review-phrase-target">{phrase.targetText}</div>
                <div className="review-phrase-block">{phrase.blockText}</div>
              </div>
            ))
          )}
        </div>

        <div className="modal-buttons">
          <button className="modal-btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
