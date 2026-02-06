import { useEffect, useState, useRef, useCallback } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensors,
  useSensor,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import { AnimatePresence } from "framer-motion"
import type { HostApi } from "./sdk/types"
import { useGameStore, type WordBlock } from "./store/gameState"
import { useGameLogic } from "./hooks/useGameLogic"
import { GameContainer } from "./components/GameContainer"
import { TopBar } from "./components/TopBar"
import { PromptPhrase } from "./components/PromptPhrase"
import { PlacementArea } from "./components/PlacementArea"
import { ChoicesBank } from "./components/ChoicesBank"
import { ControlBar } from "./components/ControlBar"
import { WordBlockOverlay } from "./components/WordBlock"
import { BottleCanvas, type BottleCanvasRef } from "./components/BottleCanvas"
import { AnswerReveal } from "./components/modals/AnswerReveal"
import { LevelComplete } from "./components/modals/LevelComplete"
import { VictoryBurst } from "./components/VictoryBurst"
import { shadeColor } from "./utils/colors"

// Lock scroll during drag
function lockScroll(lock: boolean) {
  const el = document.body
  if (lock) {
    el.style.overflow = "hidden"
    el.style.touchAction = "none"
  } else {
    el.style.overflow = ""
    el.style.touchAction = ""
  }
}

type AppProps = {
  hostApi: HostApi
  onExit: () => void
}

export function App({ hostApi, onExit }: AppProps) {
  const blocks = useGameStore((s) => s.blocks)
  const moveBlockToPlacement = useGameStore((s) => s.moveBlockToPlacement)
  const moveBlockToChoices = useGameStore((s) => s.moveBlockToChoices)
  const reorderPlacement = useGameStore((s) => s.reorderPlacement)
  const placementOrder = useGameStore((s) => s.placementOrder)
  const hasWon = useGameStore((s) => s.hasWon)
  const bottleProgress = useGameStore((s) => s.bottleProgress)

  const {
    phrase,
    loadNextPhrase,
    canGoPrev,
    canGoNext,
    goPrev,
    goNext,
    speakTarget,
    speakBlock,
    toggleFruits,
    showAnswerModal,
    handleShowAnswer,
    handleCloseAnswer,
    showLevelComplete,
    handleContinuePlaying,
    handleAdvanceLevel,
    getCurrentFruit,
    stopTTS,
  } = useGameLogic(hostApi)

  const [activeBlock, setActiveBlock] = useState<WordBlock | null>(null)
  const [isOverPlacement, setIsOverPlacement] = useState(false)
  const [victoryTrigger, setVictoryTrigger] = useState(0)
  const bottleRef = useRef<BottleCanvasRef>(null)

  // Sensors with touch delay
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    })
  )

  // Load initial phrase
  useEffect(() => {
    loadNextPhrase()
    return () => {
      stopTTS()
    }
  }, [loadNextPhrase, stopTTS])

  // Track previous bottle count to detect bottle completion
  const prevBottleCount = useRef(bottleProgress.bottleCollection.length)

  // Update bottle fill when phrases in bottle changes
  useEffect(() => {
    const percent = (bottleProgress.phrasesInCurrentBottle / 10) * 100
    bottleRef.current?.updateFill(percent)
  }, [bottleProgress.phrasesInCurrentBottle])

  // Update bottle color when color index changes
  useEffect(() => {
    const fruit = getCurrentFruit()
    bottleRef.current?.setColor(fruit)
  }, [bottleProgress.currentColorIndex, getCurrentFruit])

  // Detect bottle completion and trigger big celebration
  useEffect(() => {
    const currentCount = bottleProgress.bottleCollection.length
    if (currentCount > prevBottleCount.current) {
      // A bottle was just completed! Trigger big celebration
      bottleRef.current?.triggerWin()
      // Reset the bottle for the new one
      setTimeout(() => {
        bottleRef.current?.reset()
        const fruit = getCurrentFruit()
        bottleRef.current?.setColor(fruit)
      }, 1500)
    }
    prevBottleCount.current = currentCount
  }, [bottleProgress.bottleCollection.length, getCurrentFruit])

  // Trigger squeeze effects and victory burst on win
  useEffect(() => {
    if (hasWon) {
      setVictoryTrigger(t => t + 1) // trigger particle burst
      bottleRef.current?.triggerSqueeze()
    }
  }, [hasWon])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const block = blocks.find((b) => b.id === event.active.id)
    if (block) {
      setActiveBlock(block)
      lockScroll(true)
    }
  }, [blocks])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setIsOverPlacement(event.over?.id === "placement-area")
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    setActiveBlock(null)
    setIsOverPlacement(false)
    lockScroll(false)

    if (!over) return

    const block = blocks.find((b) => b.id === active.id)
    if (!block) return

    // Dropped on placement area
    if (over.id === "placement-area") {
      if (block.zone === "choices") {
        moveBlockToPlacement(block.id)
      }
      return
    }

    // Dropped on choices bank
    if (over.id === "choices-bank") {
      if (block.zone === "placement") {
        moveBlockToChoices(block.id)
      }
      return
    }

    // Dropped on another block
    const overBlock = blocks.find((b) => b.id === over.id)
    if (overBlock) {
      if (block.zone === "choices" && overBlock.zone === "placement") {
        // Insert at position
        const overIndex = placementOrder.indexOf(overBlock.id)
        moveBlockToPlacement(block.id, overIndex)
      } else if (block.zone === "placement" && overBlock.zone === "placement") {
        // Reorder within placement
        reorderPlacement(block.id, overBlock.id)
      } else if (block.zone === "placement" && overBlock.zone === "choices") {
        // Move back to choices
        moveBlockToChoices(block.id)
      }
    }
  }, [blocks, placementOrder, moveBlockToPlacement, moveBlockToChoices, reorderPlacement])

  const handleDragCancel = useCallback(() => {
    setActiveBlock(null)
    setIsOverPlacement(false)
    lockScroll(false)
  }, [])

  // Speak individual word in block language (skip punctuation-only tokens)
  const speakWord = useCallback((word: string) => {
    // Skip if word is only punctuation/symbols
    if (/^[\p{P}\p{S}]+$/u.test(word)) return

    const lang = phrase.blockLang || "en"
    if (hostApi.speakConcurrent) {
      hostApi.speakConcurrent(lang, word)
    } else if (hostApi.speak) {
      hostApi.speak(lang, word)
    }
  }, [hostApi, phrase.blockLang])

  const fruit = getCurrentFruit()
  const nativeLang = phrase.targetLang || "en"

  return (
    <GameContainer
      fruitPrimary={fruit.primary}
      fruitLight={shadeColor(fruit.primary, 15)}
      fruitDark={shadeColor(fruit.primary, -25)}
    >
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <TopBar onExit={onExit} />

        <div className="middle-area">
          <BottleCanvas ref={bottleRef} initialLevel="A0" />
          <PromptPhrase onTap={speakTarget} />
          <VictoryBurst trigger={victoryTrigger} color={fruit.primary} />
        </div>

        <PlacementArea isDragOver={isOverPlacement} onSpeakWord={speakWord} />
        <ChoicesBank onSpeakWord={speakWord} />

        <ControlBar
          onPrev={goPrev}
          onNext={goNext}
          onSpeak={speakBlock}
          onShowAnswer={handleShowAnswer}
          onToggleFruit={toggleFruits}
          hasPrev={canGoPrev}
          hasNext={canGoNext}
        />

        <DragOverlay>
          {activeBlock && <WordBlockOverlay block={activeBlock} />}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {showAnswerModal && <AnswerReveal onClose={handleCloseAnswer} />}
        {showLevelComplete && (
          <LevelComplete
            onContinue={handleContinuePlaying}
            onAdvance={handleAdvanceLevel}
            lang={nativeLang}
          />
        )}
      </AnimatePresence>
    </GameContainer>
  )
}
