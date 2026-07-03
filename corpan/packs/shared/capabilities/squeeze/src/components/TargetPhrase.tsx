/**
 * TargetPhrase — the phrase to translate, shown at the top in the TARGET
 * language, labeled with the TARGET language's OWN native name (e.g. "English",
 * "日本語"). The label sits with the content it describes: this prompt is in the
 * target language, so its tag is the target language — NOT the build language
 * (which is tagged down at the word bank, where you assemble the sentence).
 * Tapping the phrase re-speaks the target phrase.
 *
 * MOVED from packs/juice-squeeze/src/components (capability-modules.md §4.2):
 * round state now comes from the RoundStoreProvider; the juice-tint accent
 * (the pack's fruit gradient) arrives via the `accent` prop instead of the
 * pack's fruits store — the fruit economy stays pack-side.
 */
import { useRoundStore } from "../roundStore"
import { useFitText } from "../hooks/useFitText"
import { isRTL } from "../rtl"
import { getNativeLanguageName } from "../languageNames"

type Props = {
  onSpeakTarget: (lang: string, text: string) => void
  /** Accent gradient (light → base → dark) for the glossy prompt block.
   *  juice-squeeze passes the active fruit's gradient. */
  accent?: [string, string, string]
}

const DEFAULT_ACCENT: [string, string, string] = ["#FFB84D", "#FF9800", "#E65100"]

export function TargetPhrase({ onSpeakTarget, accent }: Props) {
  const phrase = useRoundStore((s) => s.phrase)
  const [jc1, jc2, jc3] = accent ?? DEFAULT_ACCENT
  // Auto-fit: long phrases tighten + shrink to a height budget so they never
  // push the bank off-screen; short/normal phrases are left untouched.
  const fitRef = useFitText<HTMLButtonElement>(phrase.targetText)
  if (!phrase.targetText) return null
  const targetRtl = phrase.targetLang ? isRTL(phrase.targetLang) : false

  return (
    <div className="capSqz-target">
      <button
        ref={fitRef}
        type="button"
        className="capSqz-target__text"
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
        <div className="capSqz-target__build" dir={targetRtl ? "rtl" : "ltr"}>
          {getNativeLanguageName(phrase.targetLang)}
        </div>
      )}
    </div>
  )
}
