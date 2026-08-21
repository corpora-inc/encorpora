// src/journey/exercises/IntroEcho.tsx — the new-word DEBUT (feed-ux §4 row 9).
// First exposure is a gentle COMPREHENSION beat: HEAR the target (auto-plays on
// arrival), TAP its meaning — a concept PICTURE, a numeral GLYPH, or native-gloss
// TEXT tiles — then Continue. UNSCORED: a wrong tap only REVEALS the answer (no
// red "wrong", no penalty; the FSRS card is created at the first scored
// exposure). The outcome is reported ONLY on the Continue press, and the engine
// ignores it for an unscored card (apply.ts §unscored) — so tapping is
// penalty-free by construction. Degrades to a passive show-and-tell (today's
// card) when no tappable meaning is available. Mode/tile/skin decisions live in
// the pure introEcho.ts so they stay unit-testable without a renderer.

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { isRTL } from "../../util/convert"
import { AnswerTiles } from "./common/AnswerTiles.tsx"
import { AudioButton } from "./common/AudioButton.tsx"
import { ImageTiles } from "./common/ImageTiles.tsx"
import { ReservedSlot } from "./common/ReservedSlot.tsx"
import { TargetText } from "./common/TargetText.tsx"
import { buildGlyphTiles, GLYPH_ANSWER_TILE_ID } from "./glyphs.ts"
import { buildImageTiles, IMAGE_ANSWER_TILE_ID } from "./imageChoice.ts"
import {
  buildIntroTextTiles,
  INTRO_ANSWER_TILE_ID,
  introEchoMode,
  introTileState,
} from "./introEcho.ts"
import type { ExerciseProps } from "./types.ts"

export function IntroEcho(props: ExerciseProps) {
  const { t } = useTranslation()
  const answer = props.items[0]
  const startedAt = useRef(Date.now())
  const playedRef = useRef(false)
  const [revealed, setRevealed] = useState(false)

  // Audio-first: auto-play the target once when the card becomes current
  // (§3.1 arrive; never on pre-mount, never in review).
  useEffect(() => {
    if (props.active && props.mode !== "review" && !playedRef.current) {
      playedRef.current = true
      startedAt.current = Date.now()
      void props.speak(props.spec.targetLang, answer.target.ttsText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.active])

  const isWord = answer.kind === "word" || answer.kind === "char"

  const distractorTexts = useMemo(
    () => (props.distractors?.distractors ?? []).map((d) => d.text),
    [props.distractors],
  )
  const mode = introEchoMode(props.spec.params, distractorTexts.length, props.cardId)

  const imageTiles = useMemo(
    () => (mode === "image" ? buildImageTiles(props.spec.params, props.cardId) : []),
    [mode, props.cardId], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const glyphTiles = useMemo(
    () => (mode === "glyph" ? buildGlyphTiles(props.spec.params, props.cardId) : []),
    [mode, props.cardId], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const textTiles = useMemo(
    () =>
      mode === "text" && answer.native
        ? buildIntroTextTiles(answer.native.text, distractorTexts, props.cardId)
        : [],
    [mode, props.cardId], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // A tap only REVEALS (unscored, penalty-free); the card settles/advances on
  // the Continue press below, never on a tile tap. Revealing also replays the
  // target so the sound↔meaning link lands as the answer lights up.
  const revealedOrReview = revealed || props.mode === "review"
  const reveal = () => {
    if (revealedOrReview) return
    setRevealed(true)
    void props.speak(props.spec.targetLang, answer.target.ttsText)
  }

  const interactive = mode !== "passive"

  // Passive fallback (graceful degrade): today's concept-picture hero. Shown
  // ONLY in passive mode — in the tile modes it would spoil the meaning before
  // the tap (the picture/glyph/native tile IS the thing to pick).
  const conceptImageSrc =
    !interactive && typeof props.spec.params?.conceptImageSrc === "string"
      ? props.spec.params.conceptImageSrc
      : ""
  const conceptImageAlt =
    typeof props.spec.params?.conceptImageAlt === "string" ? props.spec.params.conceptImageAlt : ""

  const nativeDir = props.spec.nativeLang && isRTL(props.spec.nativeLang) ? "rtl" : "ltr"

  const badge = (
    <div className="rounded-full bg-[hsl(var(--journey-accent,262_80%_58%)/0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground">
      {isWord ? t("journey.intro.newWord") : t("journey.intro.newPhrase")}
    </div>
  )

  const continueButton =
    props.mode === "live" ? (
      <button
        type="button"
        data-testid="journey-intro-continue"
        onClick={() => props.onOutcome({ correct: true, latencyMs: Date.now() - startedAt.current })}
        className="min-h-12 w-full rounded-xl bg-[hsl(var(--journey-accent,262_80%_58%))] text-base font-semibold text-white"
      >
        {t("journey.exercise.continue")}
      </button>
    ) : null

  // ---- Interactive debut (image / glyph / native-text tiles). Audio is the
  // hero (no written word before the reveal); the tiles carry the meaning. The
  // reveal slot is reserved from mount so filling it on tap never reflows.
  if (interactive) {
    const revealSlot = (
      <ReservedSlot minH="min-h-20">
        {revealedOrReview ? (
          <div className="flex flex-col items-center gap-1">
            <TargetText
              item={answer}
              lang={props.spec.targetLang}
              showRomanization={props.showRomanization}
              size="md"
            />
            {answer.native ? (
              <div lang={props.spec.nativeLang} dir={nativeDir} className="text-base text-muted-foreground">
                {answer.native.text}
              </div>
            ) : null}
          </div>
        ) : null}
      </ReservedSlot>
    )

    return (
      // Balanced composition on tall viewports (feed-ux): the content cluster
      // centers in the space ABOVE the Continue button, which anchors near the
      // BOTTOM of the card area — instead of the whole card (content+button)
      // clumping together mid-screen with a dead zone below the button.
      //
      // `grow` (flex-grow with flex-basis:auto — NEVER flex-1/basis-0, which
      // collapses in an auto-height parent like PlacementCard's column) makes
      // this root absorb the REAL height ActivityCardHost hands down from
      // FeedCardFrame (see the host's intro_echo `grow`). The earlier
      // 50dvh-minHeight floor could not do this: natural tile-mode content
      // already exceeds 50dvh, so the floor was a no-op, the inner flex-1 had
      // zero slack to distribute, and FeedCardFrame centered the whole block —
      // pinning content high with the button floating mid-air (the S25U
      // report). On short screens there is no free space to absorb and the
      // layout degrades to today's plain stack (min-height:auto keeps content
      // from ever compressing/overlapping).
      <div className="flex w-full grow flex-col items-center gap-5">
        <div className="flex w-full grow flex-col items-center justify-center gap-5">
          {badge}
          <AudioButton speak={props.speak} lang={props.spec.targetLang} text={answer.target.ttsText} size="lg" />
          {mode === "image" ? (
            <ImageTiles
              tiles={imageTiles}
              answerId={IMAGE_ANSWER_TILE_ID}
              picked={null}
              answered={revealedOrReview}
              disabled={revealedOrReview}
              onPick={reveal}
            />
          ) : mode === "glyph" ? (
            <div
              className="grid w-full max-w-xs grid-cols-2 gap-3"
              role="listbox"
              data-testid="journey-glyph-tiles"
            >
              {glyphTiles.map((tile) => {
                const state = introTileState(revealedOrReview, tile.id, GLYPH_ANSWER_TILE_ID)
                return (
                  <button
                    key={tile.id}
                    type="button"
                    disabled={revealedOrReview}
                    onClick={() => reveal()}
                    data-journey-tile={tile.id}
                    className={[
                      "flex aspect-square items-center justify-center rounded-lg border text-5xl font-bold tabular-nums transition-all active:scale-[0.97]",
                      state === "correct"
                        ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-500"
                        : "border-border bg-card text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    {tile.glyph}
                  </button>
                )
              })}
            </div>
          ) : (
            <AnswerTiles
              tiles={textTiles.map((tile) => ({
                ...tile,
                state: introTileState(revealedOrReview, tile.id, INTRO_ANSWER_TILE_ID),
              }))}
              lang={props.spec.nativeLang ?? props.spec.targetLang}
              disabled={revealedOrReview}
              onPick={reveal}
            />
          )}
          {revealSlot}
        </div>
        {continueButton}
      </div>
    )
  }

  // ---- Passive show-and-tell (graceful degrade): no tappable meaning, so the
  // debut shows the word + picture + native gloss and invites an aloud echo.
  // Same balanced-composition container as the interactive branch above
  // (the shared layout pattern for both intro variants — newWord/newPhrase —
  // and every IntroEcho mode): content centers above a bottom-anchored
  // Continue, absorbing the real card height via `grow` (see above).
  return (
    <div className="flex w-full grow flex-col items-center gap-6">
      <div className="flex w-full grow flex-col items-center justify-center gap-6">
        {badge}
        {conceptImageSrc ? (
          <div
            className="flex h-40 w-full max-w-xs items-center justify-center overflow-hidden rounded-lg border border-border bg-muted sm:h-48"
            data-testid="journey-intro-image"
          >
            <img src={conceptImageSrc} alt={conceptImageAlt} className="h-full w-full object-contain" />
          </div>
        ) : null}
        <TargetText item={answer} lang={props.spec.targetLang} showRomanization={props.showRomanization} />
        {answer.native ? (
          <div lang={props.spec.nativeLang} dir={nativeDir} className="text-lg text-muted-foreground">
            {answer.native.text}
          </div>
        ) : null}
        <AudioButton speak={props.speak} lang={props.spec.targetLang} text={answer.target.ttsText} size="lg" />
        <div className="text-sm text-muted-foreground">{t("journey.intro.listenAndEcho")}</div>
      </div>
      {continueButton}
    </div>
  )
}
