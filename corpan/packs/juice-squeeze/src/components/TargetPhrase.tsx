/**
 * TargetPhrase — the phrase to translate, shown at the top in the TARGET
 * language, labeled with the TARGET language's OWN native name (e.g. "English",
 * "日本語"). The label sits with the content it describes: this prompt is in the
 * target language, so its tag is the target language — NOT the build language
 * (which is tagged down at the word bank, where you assemble the sentence).
 * Tapping the phrase re-speaks the target phrase.
 */
import { useGameStore } from "../state/gameStore"
import { getAllFruits } from "../state/fruits"
import { useFitText } from "../hooks/useFitText"
import { isRTL } from "../util/rtl"
import { getNativeLanguageName } from "../util/languageNames"

type Props = {
  onSpeakTarget: (lang: string, text: string) => void
}

const FRUITS = getAllFruits()

export function TargetPhrase({ onSpeakTarget }: Props) {
  const phrase = useGameStore((s) => s.phrase)
  // Tint the phrase block with the CURRENT JUICE's color (same fruit gradient the
  // hero liquid uses) so the prompt reads as "one big block of the juice you're
  // squeezing", matching the colorful word-blocks below.
  const colorIndex = useGameStore((s) => s.bottleProgress.currentColorIndex)
  const fruit = FRUITS[((colorIndex % FRUITS.length) + FRUITS.length) % FRUITS.length] || FRUITS[0]
  const [jc1, jc2, jc3] = fruit?.gradient ?? ["#FFB84D", "#FF9800", "#E65100"]
  // Auto-fit: long phrases tighten + shrink to a height budget so they never
  // push the bank off-screen; short/normal phrases are left untouched.
  const fitRef = useFitText<HTMLButtonElement>(phrase.targetText)
  if (!phrase.targetText) return null
  const targetRtl = phrase.targetLang ? isRTL(phrase.targetLang) : false

  return (
    <div className="jsf-target">
      <button
        ref={fitRef}
        type="button"
        className="jsf-target__text"
        dir={targetRtl ? "rtl" : "ltr"}
        style={{
          ["--jc-1" as string]: jc1,
          ["--jc-2" as string]: jc2,
          ["--jc-3" as string]: jc3,
        }}
        onClick={() =>
          phrase.targetLang && phrase.targetText &&
          onSpeakTarget(phrase.targetLang, phrase.targetText)
        }
        title="Listen"
      >
        {phrase.targetText}
      </button>
      {phrase.targetLang && (
        <div className="jsf-target__build" dir={targetRtl ? "rtl" : "ltr"}>
          {getNativeLanguageName(phrase.targetLang)}
        </div>
      )}
    </div>
  )
}
