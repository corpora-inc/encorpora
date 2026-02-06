import { motion } from "framer-motion"
import { useGameStore, type CEFRLevel } from "../../store/gameState"
import { t } from "../../utils/translations"

type LevelCompleteProps = {
  onContinue: () => void
  onAdvance: () => void
  lang: string
}

const LEVEL_ORDER: CEFRLevel[] = ["A0", "A1", "A2", "B1", "B2", "C1"]

export function LevelComplete({ onContinue, onAdvance, lang }: LevelCompleteProps) {
  const bottleProgress = useGameStore((s) => s.bottleProgress)
  const getCurrentFruit = useGameStore((s) => s.getCurrentFruit)

  const currentLevel = bottleProgress.currentLevel
  const currentLevelIndex = LEVEL_ORDER.indexOf(currentLevel)
  const hasNextLevel = currentLevelIndex < LEVEL_ORDER.length - 1
  const nextLevel = hasNextLevel ? LEVEL_ORDER[currentLevelIndex + 1] : null

  const currentFruit = getCurrentFruit()
  const bottlesCompleted = bottleProgress.bottlesCompletedThisLevel

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal-content"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
      >
        <h2 className="level-complete-title">
          {t("levelComplete", lang)}
        </h2>

        <div className="level-complete-fruit">
          {currentFruit.fruit}
        </div>

        <div className="level-stats">
          <div className="stat-label">{currentFruit.name}</div>
          <div className="stat-value">
            {t("bottlesFilled", lang, { n: bottlesCompleted })}
          </div>
        </div>

        {hasNextLevel && nextLevel ? (
          <div className="level-stats">
            <div className="stat-label">
              {t("harderPhrasesHint", lang, { level: nextLevel })}
            </div>
          </div>
        ) : (
          <div className="level-stats">
            <div className="stat-value">
              {t("masteredAllLevels", lang)}
            </div>
          </div>
        )}

        <div className="modal-buttons">
          <button className="modal-btn primary" onClick={onContinue}>
            {t("continuePlaying", lang)}
          </button>
          {hasNextLevel && nextLevel && (
            <button className="modal-btn secondary" onClick={onAdvance}>
              {t("advanceTo", lang, { level: nextLevel })}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
