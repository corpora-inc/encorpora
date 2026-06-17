/**
 * TargetPhrase — the phrase to translate, shown at the top in the TARGET
 * language, with the build language shown in its NATIVE name (e.g. "español",
 * "日本語") — matching the shipped pack, no English "build in:" prefix. Tapping
 * the phrase re-speaks the target phrase.
 */
import { useGameStore } from "../state/gameStore"
import { isRTL } from "../util/rtl"
import { getNativeLanguageName } from "../util/languageNames"

type Props = {
  onSpeakTarget: (lang: string, text: string) => void
}

export function TargetPhrase({ onSpeakTarget }: Props) {
  const phrase = useGameStore((s) => s.phrase)
  if (!phrase.targetText) return null
  const targetRtl = phrase.targetLang ? isRTL(phrase.targetLang) : false

  return (
    <div className="jsf-target">
      <button
        type="button"
        className="jsf-target__text"
        dir={targetRtl ? "rtl" : "ltr"}
        onClick={() =>
          phrase.targetLang && phrase.targetText &&
          onSpeakTarget(phrase.targetLang, phrase.targetText)
        }
        title="Listen"
      >
        {phrase.targetText}
      </button>
      {phrase.blockLang && (
        <div className="jsf-target__build">{getNativeLanguageName(phrase.blockLang)}</div>
      )}
    </div>
  )
}
