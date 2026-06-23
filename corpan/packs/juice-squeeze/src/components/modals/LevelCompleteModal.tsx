/**
 * LevelCompleteModal — celebration shown when the current level's bottle quota
 * is met (or the 99-bottle cap). Mirrors the shipped showLevelComplete overlay
 * (game.ts ~1859): fruit emoji, "N bottles filled", a stack-aware "add <level>"
 * hint (or "mastered all levels" at the top), and Review / Continue buttons.
 *
 * The Review button opens a phrase-review list of the just-completed bottle.
 * Continue dismisses and resumes the loop. All copy is localized via t() in the
 * primary (UI) language.
 */
import { useState } from "react"
import type { LevelCompleteInfo } from "../../hooks/useGameLogic"
import { t } from "../../util/i18n"

type Props = {
  info: LevelCompleteInfo
  uiLang: string
  onContinue: () => void
}

const LANG_FLAGS: Record<string, string> = {
  es: "🇪🇸", ko: "🇰🇷", ja: "🇯🇵", zh: "🇨🇳", fr: "🇫🇷",
  de: "🇩🇪", it: "🇮🇹", pt: "🇵🇹", ru: "🇷🇺", ar: "🇸🇦",
  en: "🇺🇸", vi: "🇻🇳", th: "🇹🇭", id: "🇮🇩", fa: "🇮🇷",
  hi: "🇮🇳", bn: "🇧🇩", ta: "🇮🇳", te: "🇮🇳", kn: "🇮🇳",
  mr: "🇮🇳", gu: "🇮🇳", ur: "🇵🇰", pa: "🇮🇳", hu: "🇭🇺",
  pl: "🇵🇱", tr: "🇹🇷",
}
const flag = (lang: string) => LANG_FLAGS[lang.split("-")[0]] || "🌐"

export function LevelCompleteModal({ info, uiLang, onContinue }: Props) {
  const [reviewing, setReviewing] = useState(false)
  // Render the review from the snapshot captured at level-complete time — NOT the
  // live shelf, which a basket carry may have cleared (Skylar's review).
  const phrases = info.phrases

  if (reviewing) {
    return (
      <div className="jsf-overlay" onClick={() => setReviewing(false)}>
        <div className="jsf-review" onClick={(e) => e.stopPropagation()}>
          <div className="jsf-review__header">
            <h2>📜 {t("phrasesCompleted", uiLang)}</h2>
            <button
              type="button"
              className="jsf-icon-btn"
              onClick={() => setReviewing(false)}
            >
              ✕
            </button>
          </div>
          <div className="jsf-review__list">
            {phrases.length > 0 ? (
              phrases.map((p, i) => (
                <div key={i} className="jsf-review__item">
                  <div className="jsf-review__target">
                    {flag(p.targetLang)} {p.targetText}
                  </div>
                  <div className="jsf-review__block">
                    {flag(p.blockLang)} {p.blockText}
                  </div>
                </div>
              ))
            ) : (
              <div className="jsf-review__empty">{t("noPhrases", uiLang)}</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="jsf-overlay">
      <div className="jsf-levelcomplete">
        <div className="jsf-levelcomplete__title">🎉 {t("levelComplete", uiLang)} 🎉</div>
        <div className="jsf-levelcomplete__fruit">{info.fruit.fruit}</div>
        <div className="jsf-levelcomplete__stat">
          {t("bottlesFilled", uiLang, { n: info.bottlesCompleted })}
        </div>
        {info.nextLevel ? (
          <div className="jsf-levelcomplete__hint">
            {t("harderPhrasesHint", uiLang, { level: info.nextLevel })}
          </div>
        ) : (
          <div className="jsf-levelcomplete__max">
            🏆 {t("masteredAllLevels", uiLang)} 🏆
          </div>
        )}
        <div className="jsf-levelcomplete__buttons">
          <button
            type="button"
            className="jsf-btn"
            onClick={() => setReviewing(true)}
          >
            📜 {t("reviewPhrases", uiLang)}
          </button>
          <button type="button" className="jsf-btn jsf-btn--primary" onClick={onContinue}>
            {t("continuePlaying", uiLang)}
          </button>
        </div>
      </div>
    </div>
  )
}
