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
import { useBlockSizing } from "../hooks/useBlockSizing"
import { GameLayout } from "../components/GameLayout"
import { TargetPhrase } from "../components/TargetPhrase"
import { SentenceArea } from "../components/SentenceArea"
import { WordBank } from "../components/WordBank"
import { ScoreBar } from "../components/ScoreBar"
import { CoinCounter } from "../components/CoinCounter"
import { BottleCollection } from "../components/BottleCollection"
import { BottleGauge } from "../components/BottleGauge"
import { HeroVessel } from "../components/HeroVessel"
import { Controls, ExitButton } from "../components/Controls"
import { BLOCK_PALETTE } from "../components/WordBlock"
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

// Locate which container + index a block currently sits in, for slot inserts.
function locateBlock(blockId: string): { container: "bank" | number; index: number } | null {
  const s = useGameStore.getState()
  const bankIdx = s.bankOrder.indexOf(blockId)
  if (bankIdx >= 0) return { container: "bank", index: bankIdx }
  for (let r = 0; r < s.sentenceRows.length; r++) {
    const idx = s.sentenceRows[r].indexOf(blockId)
    if (idx >= 0) return { container: r, index: idx }
  }
  return null
}

export function JuiceSqueezeApp({ hostApi, initialStackConfig }: Props) {
  const phrase = useGameStore((s) => s.phrase)
  const fruitsEnabled = useGameStore((s) => s.settings.fruitsEnabled)
  const blocks = useGameStore((s) => s.blocks)
  const correctWords = useGameStore((s) => s.correctWords)

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
    const blockId = String(e.active.id)
    const over = e.over
    if (!over) return
    const overId = String(over.id)
    const store = useGameStore.getState()
    if (store.hasWon) return

    if (overId === "bank") {
      store.moveToBank(blockId)
    } else if (overId.startsWith("row-")) {
      const row = Number(overId.slice("row-".length))
      store.moveToSentence(blockId, row)
    } else if (overId.startsWith("slot-")) {
      const targetBlockId = overId.slice("slot-".length)
      if (targetBlockId === blockId) return
      const loc = locateBlock(targetBlockId)
      if (!loc) return
      if (loc.container === "bank") {
        // Insert before target in the bank. Account for removing self if it was
        // earlier in the bank (store removes-then-inserts, so use the index of
        // the target measured AFTER removal).
        const self = locateBlock(blockId)
        let idx = loc.index
        if (self && self.container === "bank" && self.index < loc.index) idx -= 1
        store.moveToBank(blockId, idx)
      } else {
        const row = loc.container
        const self = locateBlock(blockId)
        let idx = loc.index
        if (self && self.container === row && self.index < loc.index) idx -= 1
        store.moveToSentence(blockId, row, idx)
      }
    } else {
      return
    }

    logic.onSentenceChanged()
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
    console.log("[juice-squeeze-fire] booted", { version: VERSION })
  }, [hostApi])

  const onTapSpeak = useCallback(
    (word: string) => {
      // Instant tactile "snap" on TOUCH (pointer-down) so it hits immediately,
      // not after the tap-vs-drag resolves on release.
      sfx.play("snap")
      speak(blockLang, word)
    },
    [blockLang, speak, sfx]
  )

  // Tap (no drag): a bank block goes to the END of the sentence; a sentence
  // block returns to the bank. Then re-check win (shipped game.ts ~2498-2737).
  const onTap = useCallback(
    (blockId: string) => {
      const store = useGameStore.getState()
      if (store.hasWon) return
      const inBank = store.bankOrder.includes(blockId)
      if (inBank) {
        store.moveToSentence(blockId)
      } else {
        store.moveToBank(blockId)
      }
      // NOTE: no snap here. The snap already fired on pointer-DOWN (onTapSpeak),
      // so playing it again on the pointer-UP place made every tap a DOUBLE click
      // ~150ms apart. One snap per tap, on touch-down.
      logic.onSentenceChanged()
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
          target={<TargetPhrase onSpeakTarget={(l, t) => speak(l, t)} />}
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
            className="jsf-block jsf-block--ghost"
            style={{
              ["--blk" as string]:
                BLOCK_PALETTE[activeBlock.originalIndex % BLOCK_PALETTE.length],
            }}
          >
            {activeDisplay}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
