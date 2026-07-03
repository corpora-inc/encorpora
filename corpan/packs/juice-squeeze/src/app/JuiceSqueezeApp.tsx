import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import type { HostApi, StackConfig } from "../sdk/types"
import { useGameStore } from "../state/gameStore"
import { useGameLogic, FRUIT_EMOJIS } from "../hooks/useGameLogic"
import { useTTS } from "../hooks/useTTS"
import { useSfx } from "../hooks/useSfx"
import { useHaptics } from "../hooks/useHaptics"
// The round UI + placement routing moved to the cap-squeeze capability
// (capability-modules.md §4.2); this pack is their first consumer. The
// gameStore satisfies RoundState structurally, so it plugs straight into
// the capability's RoundStoreProvider.
import {
  RoundStoreProvider,
  type RoundStoreApi,
} from "@shared/capabilities/squeeze/src/roundStore"
import { routeDragEnd, routeTap } from "@shared/capabilities/squeeze/src/dnd"
import { useBlockSizing } from "@shared/capabilities/squeeze/src/hooks/useBlockSizing"
import { TargetPhrase } from "@shared/capabilities/squeeze/src/components/TargetPhrase"
import { SentenceArea } from "@shared/capabilities/squeeze/src/components/SentenceArea"
import { WordBank } from "@shared/capabilities/squeeze/src/components/WordBank"
import { BLOCK_PALETTE } from "@shared/capabilities/squeeze/src/components/WordBlock"
import "@shared/capabilities/squeeze/styles.css"
import { getAllFruits } from "../state/fruits"
import { GameLayout } from "../components/GameLayout"
import { ScoreBar } from "../components/ScoreBar"
import { CoinCounter } from "../components/CoinCounter"
import { BottleCollection } from "../components/BottleCollection"
import { BottleGauge } from "../components/BottleGauge"
import { HeroVessel } from "../components/HeroVessel"
import { Controls, ExitButton } from "../components/Controls"
import { HistoryControls } from "../components/HistoryControls"
import { LevelCompleteModal } from "../components/modals/LevelCompleteModal"
import { GiveUpOverlay } from "../components/modals/GiveUpOverlay"
import "../game.css"

declare global {
  interface Window {
    /** Synchronous debug surface for on-device CDP eval (cdp.sh eval). */
    __jsf?: {
      booted: boolean
      version: string
      languages: string[]
      levels: string[]
      phraseId?: string
      blockLang?: string
      targetLang?: string
      bankCount?: number
      sentenceWords?: string[]
      hasWon?: boolean
      lastError?: string
    }
  }
}

const VERSION = "0.1.0"

type Props = {
  hostApi: HostApi
  initialStackConfig?: StackConfig
}

// The gameStore doubles as the capability's round store (structural superset).
const roundStore: RoundStoreApi = useGameStore

const ALL_FRUITS = getAllFruits()

export function JuiceSqueezeApp({ hostApi, initialStackConfig }: Props) {
  const phrase = useGameStore((s) => s.phrase)
  const fruitsEnabled = useGameStore((s) => s.settings.fruitsEnabled)
  const blocks = useGameStore((s) => s.blocks)
  const correctWords = useGameStore((s) => s.correctWords)
  // The prompt block tints with the CURRENT JUICE's color (same fruit gradient
  // the hero liquid uses) — passed to the moved TargetPhrase as its accent
  // (the fruit economy stays pack-side; the capability takes a plain prop).
  const colorIndex = useGameStore((s) => s.bottleProgress.currentColorIndex)
  const accentFruit =
    ALL_FRUITS[((colorIndex % ALL_FRUITS.length) + ALL_FRUITS.length) % ALL_FRUITS.length] ||
    ALL_FRUITS[0]

  // Responsive block sizing (FIX 1): measure .jsf-main and compute a shared
  // baseUnit from the phrase words, so bank + sentence blocks always match and
  // long phrases / long words shrink to fit instead of overflowing.
  const { containerRef, sizeFor } = useBlockSizing(correctWords)

  // Single "pressed" block id for grow-on-touch feedback (FIX 3).
  const [pressedId, setPressedId] = useState<string | null>(null)

  const blockLang = phrase.blockLang || "en"
  const rtl = useMemo(() => {
    // isRTL is cheap + pure; importing here keeps the app self-contained.
    return ["ar", "fa", "ur", "he", "pa-Arab"].includes(blockLang)
  }, [blockLang])

  const uiLang = useMemo(
    () => initialStackConfig?.languages?.[0] || hostApi.getStackConfig().languages?.[0] || "en",
    [hostApi, initialStackConfig]
  )

  const { speak } = useTTS(hostApi)
  const sfx = useSfx()
  const haptics = useHaptics(hostApi)
  const logic = useGameLogic(hostApi)

  const [activeId, setActiveId] = useState<string | null>(null)

  // Distance-based activation for BOTH sensors (no hold-delay) so dragging and
  // tapping feel instant. Our play area doesn't scroll, so distance activation
  // on touch is safe and snappy.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } })
  )

  // ---- Drag/drop placement ------------------------------------------------
  // Survives the activeId clear in onDragEnd: dnd-kit clears activeId BEFORE the
  // browser's onTouchEnd fires, so a reorder-drag would otherwise leak through
  // the `if (activeId)` guard and trigger a phrase swipe. This ref is set on
  // drag start, reset on each new touch start, and checked in onTouchEnd.
  const dragOccurredRef = useRef(false)

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
    setPressedId(null) // a drag took over; drop the pressed scale
    dragOccurredRef.current = true
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    // Placement routing is the moved cap-squeeze logic (dnd.ts) — one
    // implementation for the pack and the capability round.
    if (routeDragEnd(roundStore, e)) {
      logic.onSentenceChanged()
    }
  }

  // ---- Swipe navigation (left = next, right = prev) -----------------------
  const touch = useRef<{ x: number; y: number } | null>(null)
  const SWIPE_THRESHOLD = 50
  const SWIPE_VERTICAL_LIMIT = 100

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragOccurredRef.current = false // fresh touch; no drag yet
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touch.current
      touch.current = null
      if (!start) return
      // A reorder-drag must never count as a swipe. dragOccurredRef survives the
      // activeId clear in onDragEnd (which fires before this), so it's the
      // reliable guard; activeId stays as a belt-and-suspenders check.
      if (dragOccurredRef.current || activeId) return
      const dx = e.changedTouches[0].clientX - start.x
      const dy = e.changedTouches[0].clientY - start.y
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_VERTICAL_LIMIT) {
        if (dx < 0) logic.goNext()
        else logic.goPrev()
      }
    },
    [activeId, logic]
  )

  // ---- Boot debug surface (synchronous, before first phrase) --------------
  useEffect(() => {
    if (!window.__jsf) {
      const cfg = hostApi.getStackConfig()
      window.__jsf = {
        booted: true,
        version: VERSION,
        languages: cfg.languages ?? [],
        levels: cfg.levels ?? [],
      }
    }
    console.log("[juice-squeeze] booted", { version: VERSION })
  }, [hostApi])

  const onTapSpeak = useCallback(
    (word: string) => {
      // Instant tactile "snap" + light haptic on TOUCH (pointer-down) so it hits
      // immediately, not after the tap-vs-drag resolves on release.
      sfx.play("snap")
      haptics.fire("light")
      // Skip the per-word voice on the tap that places the LAST bank word: it
      // completes the phrase and the win-sentence TTS reads the whole sentence
      // (including this word) a moment later. On Android (single-utterance TTS)
      // the two collided and the final word felt clipped (Skylar's Android note);
      // the snap + haptic still give instant feedback.
      if (useGameStore.getState().bankOrder.length <= 1) return
      speak(blockLang, word)
    },
    [blockLang, speak, sfx, haptics]
  )

  // Tap (no drag): a bank block goes to the END of the sentence; a sentence
  // block returns to the bank. Then re-check win. Routing is the moved
  // cap-squeeze logic (dnd.ts).
  // NOTE: no snap here. The snap already fired on pointer-DOWN (onTapSpeak),
  // so playing it again on the pointer-UP place made every tap a DOUBLE click
  // ~150ms apart. One snap per tap, on touch-down.
  const onTap = useCallback(
    (blockId: string) => {
      if (routeTap(roundStore, blockId)) {
        logic.onSentenceChanged()
      }
    },
    [logic]
  )

  const activeBlock = activeId ? blocks[activeId] : null
  const activeDisplay = activeBlock
    ? fruitsEnabled
      ? FRUIT_EMOJIS[activeBlock.originalIndex % FRUIT_EMOJIS.length]
      : activeBlock.word
    : null

  return (
    <RoundStoreProvider value={roundStore}>
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="jsf-swipe" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <GameLayout
          mainRef={containerRef}
          hero={<HeroVessel onReady={logic.setLiquidController} />}
          header={
            <>
              <div className="jsf-header__left">
                <div className="jsf-header__tallies">
                  <ScoreBar />
                  <CoinCounter />
                </div>
                <BottleCollection />
              </div>
              <BottleGauge />
            </>
          }
          target={
            <TargetPhrase
              onSpeakTarget={(l, t) => speak(l, t)}
              accent={accentFruit?.gradient}
            />
          }
          sentence={
            <SentenceArea
              blockLang={blockLang}
              fruitsEnabled={fruitsEnabled}
              rtl={rtl}
              sizeFor={sizeFor}
              pressedId={pressedId}
              onPressChange={setPressedId}
              onTapSpeak={onTapSpeak}
              onTap={onTap}
            />
          }
          nav={
            <HistoryControls
              canPrev={logic.canPrev}
              canNext={logic.canNext}
              onPrev={logic.goPrev}
              onNext={logic.goNext}
            />
          }
          bank={
            <WordBank
              blockLang={blockLang}
              fruitsEnabled={fruitsEnabled}
              rtl={rtl}
              sizeFor={sizeFor}
              pressedId={pressedId}
              onPressChange={setPressedId}
              onTapSpeak={onTapSpeak}
              onTap={onTap}
            />
          }
          controls={
            <Controls
              onFruit={logic.toggleFruits}
              onGiveUp={logic.showGiveUp}
              onEar={logic.speakAnswer}
            />
          }
          exit={<ExitButton />}
          overlays={
            <>
              {logic.winFlash > 0 && (
                <div
                  key={logic.winFlash}
                  className="jsf-winflash"
                  data-testid="win-flash"
                  aria-hidden="true"
                >
                  <span className="jsf-winflash__badge">✓</span>
                </div>
              )}
              {logic.loading && <div className="jsf-loading">…</div>}
              {logic.giveUpText !== null && (
                <GiveUpOverlay text={logic.giveUpText} onClose={logic.closeGiveUp} />
              )}
              {logic.levelComplete && (
                <LevelCompleteModal
                  info={logic.levelComplete}
                  uiLang={uiLang}
                  onContinue={logic.dismissLevelComplete}
                />
              )}
            </>
          }
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDisplay !== null && activeBlock ? (
          <div
            className="capSqz-block capSqz-block--ghost"
            style={{
              ["--capSqz-blk" as string]:
                BLOCK_PALETTE[activeBlock.originalIndex % BLOCK_PALETTE.length],
            }}
          >
            {activeDisplay}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
    </RoundStoreProvider>
  )
}
