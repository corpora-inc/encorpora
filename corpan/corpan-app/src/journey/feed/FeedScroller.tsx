// src/journey/feed/FeedScroller.tsx — the purpose-built 3-slot window
// (feed-ux §1.3, §3): prev (read-only review) / current / next (pre-mounted,
// peeking after completion). framer-motion drag (NOT CSS scroll-snap — we
// intercept for skip semantics, read-only back pages, settle animation);
// wheel + keyboard (↑/↓/Space) for desktop.

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion"
import { ChevronsUp } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ActivityResult, ActivitySpec } from "../../contentPacks/activityContract"
import { celebrate, skipCelebration } from "../celebration/CelebrationLayer.tsx"
import { ComboCounter } from "../celebration/ComboCounter.tsx"
import { cardTransition } from "./cardTransition.ts"
import { useJourneyStore } from "../../store/journey.ts"
import type { CompletedCard, FeedCard, SessionStats } from "../types.ts"
import type { JourneyRuntime } from "../runtime.ts"
import type { SpeakFn } from "../exercises/types.ts"
import { advanceRule, isListeningCard, isListeningRunStart } from "./advanceRules.ts"
import { ActivityCardHost } from "./ActivityCardHost.tsx"
import { BlockIntroCard } from "./BlockIntroCard.tsx"
import { BossBanner, CheckpointCard } from "./CheckpointCard.tsx"
import { FeedCardFrame } from "./FeedCardFrame.tsx"
import { JumpOfferCard } from "./JumpOfferCard.tsx"
import { PackActivityCard } from "./PackActivityCard.tsx"
import { RareCard } from "./RareCard.tsx"
import { DelightVariantCard } from "./rare/DelightVariantCard.tsx"
import { EtymologyGemCard } from "./rare/EtymologyGemCard.tsx"
import { TimeCapsuleCard } from "./rare/TimeCapsuleCard.tsx"
import { WelcomeBackCard } from "./WelcomeBackCard.tsx"
import { CapabilityCard } from "../cards/CapabilityCard.tsx"

const SWIPE_COMMIT_PX = 90
// Double-swipe skip confirm window. Widened from 1500ms → 2500ms so ONE
// deliberate second swipe reliably confirms a skip (the old window was so tight
// that the second swipe routinely landed after it lapsed, forcing many swipes).
const SKIP_CONFIRM_MS = 2500

export interface FeedScrollerProps {
  runtime: JourneyRuntime
  courseKey: string
  speak: SpeakFn
  showRomanization: boolean
  dailyGoal: number
  unitName: string | null
  streakDays: number
  onExit: () => void
  onLaunchPack?: (packId: string, spec: ActivitySpec) => void
}

export function FeedScroller(props: FeedScrollerProps) {
  const { t } = useTranslation()
  const { runtime } = props
  const advanceMode = useJourneyStore((s) => s.advanceMode)
  const [, force] = useState(0)
  const [backIndex, setBackIndex] = useState(0) // 0 = live, N = N pages back
  const [skipArmedAt, setSkipArmedAt] = useState(0)
  const skipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [listeningRun, setListeningRun] = useState(false)
  const [autoCountdown, setAutoCountdown] = useState(false)
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controls = useAnimationControls()
  const reducedMotion = !!useReducedMotion()

  useEffect(() => runtime.subscribe(() => force((v) => v + 1)), [runtime])

  // Disarm a pending skip whenever the live card changes — an armed skip must
  // never carry over to the NEXT card (that race made skip land on the wrong
  // card). Also cleans the timer on unmount.
  const currentId = runtime.current()?.cardId
  useEffect(() => {
    if (skipTimer.current) clearTimeout(skipTimer.current)
    skipTimer.current = null
    setSkipArmedAt(0)
    return () => {
      if (skipTimer.current) clearTimeout(skipTimer.current)
      skipTimer.current = null
    }
  }, [currentId])

  const current = runtime.current()
  const next = runtime.next()
  const history = runtime.history()
  const settledRec = runtime.currentSettled()
  const settled = settledRec !== null

  // impressions
  useEffect(() => {
    if (current && backIndex === 0) runtime.noteImpression(current.cardId)
  }, [current, backIndex, runtime])

  // listening-run pill arming (§3.2)
  useEffect(() => {
    if (current && next && isListeningRunStart(current, next)) return // pill offered
    if (current && !isListeningCard(current)) setListeningRun(false)
  }, [current, next])

  const clearAuto = useCallback(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current)
    autoTimer.current = null
    setAutoCountdown(false)
  }, [])

  const doAdvance = useCallback(() => {
    clearAuto()
    skipCelebration()
    runtime.advance()
  }, [runtime, clearAuto])

  // Explicit-button cards (intro_echo / flip_recall Continue) advance the
  // instant the learner presses — no lingering settled card to swipe past
  // (contract #6 (a)). The host calls this from onRequestAdvance after settle;
  // answer-tap cards return a non-"button" rule and are ignored here (their
  // countdown-ring auto-advance is armed by the effect below).
  const requestAdvance = useCallback(
    (card: FeedCard) => {
      if (backIndex !== 0) return
      if (advanceRule(card, advanceMode).kind === "button") doAdvance()
    },
    [advanceMode, backIndex, doAdvance],
  )

  // auto-advance arming per rules table
  useEffect(() => {
    clearAuto()
    if (!current || !settled || backIndex !== 0) return
    const failed = (settledRec?.result?.score ?? 1) < 0.6 && settledRec?.result?.abandoned !== true
    const rule = advanceRule(current, advanceMode, { listeningRun, failed })
    if (rule.kind === "auto" && !failed) {
      setAutoCountdown(true)
      autoTimer.current = setTimeout(doAdvance, rule.delayMs)
    }
    return clearAuto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.cardId, settled, advanceMode, listeningRun, backIndex])

  // pack return celebration (§6.2): tier 1 for score ≥ 0.8, tier 0 else;
  // rare rolls already played tier 3 pre-launch — capped at 1 (no double jackpot).
  useEffect(() => {
    if (!settledRec || settledRec.card.kind !== "packActivity") return
    const score = settledRec.result?.score ?? 0
    if (settledRec.result?.abandoned) {
      doAdvance()
      return
    }
    void celebrate({ tier: score >= 0.8 ? 1 : 0 }).then(() => {
      setTimeout(doAdvance, 400)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledRec?.card.cardId])

  const submit = useCallback(
    (cardId: string, r: ActivityResult) => {
      runtime.submitResult(cardId, r)
    },
    [runtime],
  )

  const onForwardGesture = useCallback(() => {
    if (backIndex > 0) {
      setBackIndex((i) => i - 1)
      return
    }
    if (!current) return
    if (current.kind === "checkpoint") {
      // swiping forward equals "Keep going" (§3.5)
      runtime.checkpointChoice(current.cardId, "continue")
      return
    }
    if (settled) {
      doAdvance()
      return
    }
    const rule = advanceRule(current, advanceMode)
    if (rule.kind === "manual" && current.kind !== "packActivity") return
    // incomplete card: double-swipe skip semantics (§3.5). The SECOND swipe
    // within the (widened) confirm window skips; the first arms + shows the
    // "swipe again to skip" hint. A timer clears the arm so the window is
    // authoritative (no stale Date.now() math at render), making a single
    // confirmed double-swipe reliably advance.
    const now = Date.now()
    if (skipArmedAt && now - skipArmedAt <= SKIP_CONFIRM_MS) {
      if (skipTimer.current) clearTimeout(skipTimer.current)
      skipTimer.current = null
      setSkipArmedAt(0)
      runtime.abandonCurrent()
    } else {
      setSkipArmedAt(now)
      if (skipTimer.current) clearTimeout(skipTimer.current)
      skipTimer.current = setTimeout(() => {
        skipTimer.current = null
        setSkipArmedAt(0)
      }, SKIP_CONFIRM_MS)
      void controls.start({ y: [0, -24, 0], transition: { duration: 0.3 } })
    }
  }, [backIndex, current, settled, advanceMode, skipArmedAt, runtime, doAdvance, controls])

  const onBackGesture = useCallback(() => {
    const max = history.length
    setBackIndex((i) => {
      const nextIndex = Math.min(i + 1, max)
      // Scrolling BACK to a completed exercise clears its one-way settled gate
      // so the learner can redo it — even a previously-correct one (§3.4). The
      // review render then becomes interactive (see renderCard mode below).
      if (nextIndex > 0) {
        const rec = history[history.length - nextIndex]
        if (rec) runtime.clearSettled(rec.card.cardId)
      }
      return nextIndex
    })
  }, [history, runtime])

  // keyboard + wheel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault()
        onForwardGesture()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        onBackGesture()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onForwardGesture, onBackGesture])

  const wheelLock = useRef(0)
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const now = Date.now()
      if (now - wheelLock.current < 350) return
      if (Math.abs(e.deltaY) < 24) return
      wheelLock.current = now
      if (e.deltaY > 0) onForwardGesture()
      else onBackGesture()
    },
    [onForwardGesture, onBackGesture],
  )

  const stats: SessionStats = runtime.sessionStats()
  // Combo-reactive card-to-card spring (§3.1): the advance gets a hair snappier
  // as the streak climbs; reduced-motion collapses it to a cross-fade.
  const advanceTransition = cardTransition(stats.combo, reducedMotion)
  const quota = runtime.peekQuota()
  const cardsToday = useJourneyStore((s) => s.byCourse[props.courseKey]?.cardsToday.count ?? 0)

  const renderCard = (card: FeedCard, mode: "live" | "review" | "redo") => {
    const hostMode = mode === "redo" ? "live" : mode
    switch (card.kind) {
      case "exercise": {
        const body = (
          <ActivityCardHost
            key={card.cardId}
            card={card}
            mode={hostMode}
            combo={stats.combo}
            speak={props.speak}
            showRomanization={props.showRomanization}
            active={(mode === "live" && backIndex === 0) || mode === "redo"}
            onResult={(r) => submit(card.cardId, r)}
            onRequestAdvance={() => requestAdvance(card)}
          />
        )
        const boss = card.prepared.engine.meta.checkpoint
        const framed = boss ? (
          <div className="flex w-full flex-col items-center">
            <BossBanner scope={boss.scope} index={boss.index} count={boss.count} />
            {body}
          </div>
        ) : (
          body
        )
        // review + redo render the plain (framed) exercise — no rare
        // celebration overlays on a scroll-back or a redo attempt.
        if (!card.rare || mode !== "live") {
          return framed
        }
        if (card.rare === "etymology") {
          return (
            <RareCard
              variant="etymology"
              revealed={!!revealed[card.cardId]}
              onReveal={() => setRevealed((r) => ({ ...r, [card.cardId]: true }))}
            >
              <EtymologyGemCard
                item={card.prepared.items[0]}
                example={card.prepared.example}
                targetLang={card.spec.targetLang}
                nativeLang={card.spec.nativeLang}
                onContinue={(latencyMs) =>
                  submit(card.cardId, {
                    specId: card.spec.specId,
                    score: 1,
                    perItem: [],
                    durationMs: latencyMs,
                  })
                }
              />
            </RareCard>
          )
        }
        const face =
          card.rare === "timeCapsule" ? (
            <TimeCapsuleCard>{framed}</TimeCapsuleCard>
          ) : (
            <DelightVariantCard>{framed}</DelightVariantCard>
          )
        return (
          <RareCard
            variant={card.rare}
            revealed={!!revealed[card.cardId]}
            onReveal={() => setRevealed((r) => ({ ...r, [card.cardId]: true }))}
          >
            {face}
          </RareCard>
        )
      }
      case "checkpoint":
        return (
          <CheckpointCard
            summary={card.summary}
            stats={stats}
            cardsToday={cardsToday}
            dailyGoal={props.dailyGoal}
            unitName={props.unitName}
            quotaRemaining={quota.remaining}
            quotaLimit={quota.limit}
            streakDays={props.streakDays}
            nextTease={null}
            onDone={() => {
              runtime.checkpointChoice(card.cardId, "stop")
              props.onExit()
            }}
            onKeepGoing={() => runtime.checkpointChoice(card.cardId, "continue")}
          />
        )
      case "packActivity":
        return (
          <PackActivityCard
            card={card}
            pending={runtime.packReturnPending() === card.cardId}
            onPlay={() => {
              const launch = (packId: string, spec: ActivitySpec) =>
                props.onLaunchPack?.(packId, spec)
              // Current poster → graded launch (advances the feed). A
              // scrolled-back poster (review/redo) was already consumed, so the
              // graded path's guard would reject it — replay it for free
              // practice instead, so "Play" is never a dead button.
              if (mode === "live") runtime.launchPackActivity(card, launch)
              else runtime.replayPackActivity(card, launch)
            }}
          />
        )
      case "capability":
        return (
          <CapabilityCard
            card={card}
            active={mode === "live" && backIndex === 0}
            onResult={(r) => submit(card.cardId, r)}
          />
        )
      case "blockIntro":
        return (
          <BlockIntroCard
            blockLen={card.blockLen}
            onReady={() => runtime.completePresentation(card.cardId)}
          />
        )
      case "welcomeBack":
        return (
          <WelcomeBackCard
            retainedPct={card.retainedPct}
            onContinue={() => runtime.completePresentation(card.cardId)}
          />
        )
      case "jumpOffer":
        return (
          <JumpOfferCard
            onAccept={() => runtime.acceptJumpOffer(card.cardId)}
            onDecline={() => {
              runtime.submitResult(card.cardId, {
                specId: card.cardId,
                score: 0,
                perItem: [],
                durationMs: 0,
              })
              runtime.advance()
            }}
          />
        )
    }
  }

  // read-only back page (§3.4). An exercise/pack card whose result was cleared
  // (by onBackGesture → runtime.clearSettled) becomes a REDO: interactive
  // again so the learner can re-answer it.
  const backRecord: CompletedCard | null =
    backIndex > 0 ? (history[history.length - backIndex] ?? null) : null
  const backRedoable =
    !!backRecord &&
    backRecord.result === null &&
    (backRecord.card.kind === "exercise" ||
      backRecord.card.kind === "packActivity" ||
      backRecord.card.kind === "capability")

  const listeningPill =
    backIndex === 0 &&
    current &&
    next &&
    !listeningRun &&
    isListeningRunStart(current, next) &&
    advanceMode !== "auto"

  const empty = !current && history.length > 0

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden touch-none"
      onWheel={onWheel}
      data-testid="journey-feed"
      // Respect the device safe area so no card is clipped at the bottom
      // (notch / home-indicator). Uses env() with a 0 fallback on desktop.
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <motion.div
        className="flex h-full w-full flex-col"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.25}
        animate={controls}
        onDragEnd={(_, info) => {
          if (info.offset.y < -SWIPE_COMMIT_PX) onForwardGesture()
          else if (info.offset.y > SWIPE_COMMIT_PX) onBackGesture()
        }}
      >
        <AnimatePresence mode="popLayout">
          {backRecord ? (
            <motion.div
              key={`back-${backRecord.card.cardId}`}
              className="h-full w-full"
              initial={reducedMotion ? { opacity: 0 } : { y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
              transition={advanceTransition}
            >
              <FeedCardFrame
                card={backRecord.card}
                settled={!backRedoable}
                review={!backRedoable}
                reviewLabel={`${t("journey.exercise.reviewedEarlier")} · ${backIndex}/${history.length}`}
              >
                {backRedoable ? (
                  <div className="w-full">{renderCard(backRecord.card, "redo")}</div>
                ) : (
                  // NOT pointer-events-none: a reviewed card must still let the
                  // learner REPLAY audio and open the (?) hint (hear + get hints
                  // before AND after answering). Re-answering is already blocked
                  // because each exercise disables its own answer controls in
                  // review mode — so only the answer tiles are inert, not audio.
                  <div className="w-full opacity-90">
                    {renderCard(backRecord.card, "review")}
                  </div>
                )}
              </FeedCardFrame>
            </motion.div>
          ) : current ? (
            <motion.div
              key={current.cardId}
              className="h-full w-full"
              data-journey-current={current.cardId}
              initial={reducedMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { y: -80, opacity: 0 }}
              transition={advanceTransition}
            >
              <FeedCardFrame card={current} settled={settled} review={false}>
                {renderCard(current, "live")}
              </FeedCardFrame>
            </motion.div>
          ) : (
            <motion.div
              key="feed-end"
              className="flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="text-2xl font-bold text-foreground">
                {empty ? t("journey.feed.caughtUp") : t("journey.feed.loading")}
              </div>
              {empty ? (
                <button
                  type="button"
                  onClick={props.onExit}
                  className="min-h-12 rounded-xl border border-border bg-card px-6 text-base font-semibold text-foreground"
                >
                  {t("journey.checkpoint.done")}
                </button>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* next-card affordance after completion (§3.1 step 4): a gently bouncing
          upward chevron that reads unambiguously as "swipe up to continue" — NOT
          a card-colored drawer (the old bottom sliver read as a blank clipped
          card on gesture-nav phones). Sits fully above the container's
          safe-area inset (bottom-4), so it is never clipped by the home
          indicator / gesture bar. Only shown when a real next card exists and
          the card is not auto-advancing on its own. */}
      {settled && next && backIndex === 0 && !autoCountdown ? (
        <motion.div
          className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, -6, 0] }}
          transition={{
            opacity: { duration: 0.3 },
            y: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
          }}
          aria-hidden
        >
          <ChevronsUp className="h-6 w-6 text-muted-foreground/50" />
        </motion.div>
      ) : null}

      {/* skip hint (§3.5 first forward-swipe on incomplete card) — armed state
          is cleared by a timer, so its truthiness alone is authoritative */}
      <AnimatePresence>
        {skipArmedAt > 0 ? (
          <motion.div
            key="skip-hint"
            className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="rounded-full bg-muted px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
              {t("journey.exercise.skipHint")}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* hands-free listening pill (§3.2) */}
      {listeningPill ? (
        <div className="absolute inset-x-0 top-3 flex justify-center">
          <button
            type="button"
            onClick={() => setListeningRun(true)}
            className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm"
          >
            {t("journey.settings.listeningMode")} ▸
          </button>
        </div>
      ) : null}

      {/* auto-advance countdown ring (tap to pause) */}
      {autoCountdown && (listeningRun || advanceMode === "auto") ? (
        <button
          type="button"
          onClick={clearAuto}
          className="absolute bottom-6 end-6 h-8 w-8 animate-pulse rounded-full border-2 border-[hsl(var(--journey-accent,262_80%_58%))]"
          aria-label={t("journey.settings.listeningMode")}
        />
      ) : null}

      {/* ambient momentum gauge (§3.5): a small squared bar in the top-trailing
          corner that fills + warms with the streak and exhales on a break — the
          learner reads their momentum off the feel, not a number. Fixed overlay,
          never jolts the layout; hidden below combo 2. */}
      {backIndex === 0 ? (
        <div className="pointer-events-none absolute end-3 top-3">
          <ComboCounter combo={stats.combo} />
        </div>
      ) : null}

      {/* The "reviewed earlier · N/M" depth chip now renders IN-FLOW inside the
          card (FeedCardFrame reviewLabel), so it can never float over / cover the
          exercise on scroll-back (the old absolute top chip did). */}
    </div>
  )
}
