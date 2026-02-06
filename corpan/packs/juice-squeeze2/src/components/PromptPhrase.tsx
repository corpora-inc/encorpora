import { useGameStore } from "../store/gameState"
import { getTextDirection } from "../utils/rtl"

type PromptPhraseProps = {
  onTap: () => void
}

export function PromptPhrase({ onTap }: PromptPhraseProps) {
  const phrase = useGameStore((s) => s.phrase)

  if (!phrase.targetText || !phrase.targetLang) {
    return null
  }

  const dir = getTextDirection(phrase.targetLang)

  return (
    <div className="prompt-phrase" onClick={onTap} dir={dir}>
      <div className="prompt-lang-label">
        {phrase.targetLang.toUpperCase()}
      </div>
      <div className="prompt-text">
        {phrase.targetText}
      </div>
    </div>
  )
}
